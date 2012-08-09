import inspect
import json
import datetime
import logging
import rozengine
import re

from jinja2 import nodes
from jinja2.ext import Extension
from functools import wraps, update_wrapper, WRAPPER_ASSIGNMENTS
from google.appengine.ext.db import Property
from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.api import datastore_types


def safe_getattr(obj, attr, default=None):
  if hasattr(obj, attr):
    return getattr(obj, attr)
  else:
    return default
    
def safe_setattr(obj, attr, default=None):
  if hasattr(obj, attr):
    setattr(obj, attr, default)

def import_from_string(name, safe=False):
    try:
      mod = __import__(name)
      components = name.split('.')
      for comp in components[1:]:
          mod = getattr(mod, comp)
      return mod
    except ImportError as error:
      if safe:
        return None
      else:
        raise error    
        
def is_serializable(p, v):
  if inspect.isclass(v) and issubclass(v, db.Model):
    return True

  return not p.startswith("_") and not inspect.isclass(v) and \
    v.__class__.__name__ != "property" and v.__class__.__name__ != "function" and \
    not v.__class__.__name__.startswith('_')


def available_attrs(fn):
    """
    Return the list of functools-wrappable attributes on a callable.
    This is required as a workaround for http://bugs.python.org/issue3445.
    """
    return tuple(a for a in WRAPPER_ASSIGNMENTS if hasattr(fn, a))

def humanize(val):
  new_parts = []
  parts = val.split('_')
  parts = " ".join(parts).split(' ')
  
  for word in parts:
    word = "".join([word[0].upper()] + list(word[1:]))
    new_parts.append(word)
    
  return " ".join(new_parts)        
        
class JSONEncoder(json.JSONEncoder):
  def default(self, obj):
  
    if isinstance(obj, datetime.datetime) or \
      isinstance(obj, datetime.date) or \
      isinstance(obj, datetime.time):
      return obj.isoformat()
    
    elif isinstance(obj, db.Model):
      vals = dict((p, getattr(obj, p)) 
                    for p in obj.properties())
                    
      if hasattr(obj, 'key_or_id'):
        vals['key_or_id'] = getattr(obj, 'key_or_id')
      else:
        vals['key_or_id'] = obj.key().id_or_name()
        
      vals['__str__'] = str(obj)
        
      return vals
      
    elif inspect.isclass(obj) and issubclass(obj, db.Model):
      vals = {}
      vals['key_or_id'] = {'dbtype': 'Key', 'name': 'key_or_id', 'verbose_name': 'Key', 'creation_counter':-1}
      #vals['__str__'] = {'dbtype': '__internal__', 'name': '__str__', 'creation_counter':-1}
      
      for p, v in vars(obj).iteritems():
        if is_serializable(p, v):
          
          dbtype = v.__class__.__name__
          vals[p] = {'dbtype': dbtype}
            
          for pp, vv in vars(v).iteritems():
            if not inspect.isclass(vv) or (inspect.isclass(vv) and not issubclass(vv, db.Model)):
              vals[p][pp] = getattr(v, pp)
            elif pp == "reference_class":
              vals[p][pp] = v.reference_class.__module__ + "." + v.reference_class.__name__
            else:
              vals[p][pp] = pp
      return vals
      
    elif inspect.isclass(obj):
       return obj.__module__ + "." + obj.__name__
    
    elif inspect.ismodule(obj):
      return None
      
    elif isinstance(obj, rozengine.RozModel) or isinstance(obj, rozengine.RozApp):
      
      return dict((p, getattr(obj, p)) 
                    for p, v in vars(obj).iteritems() if is_serializable(p, v))
    elif isinstance(obj, Property):
      return dict((p, getattr(obj, p)) 
                    for p, v in vars(obj).iteritems())
                    
    elif isinstance(obj, users.User):
      value = {}
      for key in ['email', 'nickname', 'user_id', 'federated_identity', 'federated_provider']:
        value[key] = getattr(obj, key)()
        
      value['__str__'] = value['nickname']
      value['__type__'] = 'User'
      
      return value
      
    elif isinstance(obj, db.Key):
      value = {}
      for key in ['id', 'id_or_name', 'kind', 'name', 'namespace', 'app', 'parent']:
        value[key] = getattr(obj, key)()
        
      value['__str__'] = value['id_or_name']
      value['__type__'] = 'Key'
      return value
      
    else:
      return super(JSONEncoder, self).default(obj)
      
      
class RozJSEscapeExtension(Extension):
    # a set of names that trigger the extension.
    tags = set(['rozjsescape'])

    def parse(self, parser):
        lineno = parser.stream.next().lineno
        body = parser.parse_statements(['name:endrozjsescape'], drop_needle=True)
        return nodes.CallBlock(self.call_method('_escape_it', []),
                               [], [], body).set_lineno(lineno)

    def _escape_it(self, caller):
        """Helper callback."""
        content = caller()
        content = content.replace("\t", "  ")
        content = content.replace("\n", "  ")
        content = re.sub(r"\s\s+", " ", str(content))
        
        return content