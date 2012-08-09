import jinja2
import os
import sys 
import webapp2
import logging
import inspect
import json
import datetime

import handlers
import util

from util import safe_getattr
from google.appengine.ext.db import Property
from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.api import datastore_types

def register_apps(apps):
  if RozEngine.Engine is None:
    RozEngine.Engine = RozEngine()
  
  RozEngine.Engine.register_apps(apps)
  
  return RozEngine.Engine

class RozEngine:
  
  ROUTES = [
    ('/{{prefix}}/', handlers.Dashboard, 'dashboard'),
    ('/{{prefix}}/js_templates/<file>.html.js', handlers.JSTemplates, 'jshandler')
  ]
  
  DEFAULT_RESPONSE_CONTEXT = handlers.RozBaseHandler.default_respons_contexts() 
  
  Engine = None
  
  def __init__(self):
  
    self.webapp = webapp2.get_app()
    self.webapp.rozengine = self
    
    self.enabled = True
    self.admin_enabled = True
    self.admin_path = 'admin'
    self.registerd_apps = []
    self.apps = {}
    self.models = {}
    
    self._template_path = os.path.dirname(__file__) + "/templates"
    self._registered_default_url = False

    self.template_engine = jinja2.Environment(
        loader=jinja2.FileSystemLoader(self._template_path))
        
    self.admin_template_engine = jinja2.Environment(
        loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/templates"))
    
    self.routes = RozEngine.ROUTES   
    self.app_routes = RozApp.ROUTES
    
    self.model_routes = RozModel.ROUTES
    
    RozEngine.Engine = self
       
  @property
  def template_path(self):
    return self._template_path
    
  @template_path.setter
  def template_path(self, path):
    self._template_path = path
    
    self.template_engine = jinja2.Environment(
        loader=jinja2.FileSystemLoader(self._template_path))
        
  @property
  def enable():
    return self.enabled
    
  
  @enable.setter
  def enable(self, value):
    self.enabled = value
      
  def register_apps(self, apps):
    self.register_app('rozengine.app')
    for app in apps:
      self.register_app(app)
    
      
  def register_app(self, app):
  
    self.apps[app] = RozApp(app)
    self.registerd_apps.append(app)
    self.register_urls(app)

  def register_urls(self, app_name, add_defaults=True):
  
    if not self._registered_default_url:
      self._registered_default_url = True
      
      for route in self.routes:
        r = list(route)
        defaults = {'prefix':self.admin_path}
        r[0] = reduce(lambda x, y: x.replace('{{'+y+'}}', defaults[y]), defaults, r[0])
        self.webapp.router.add(webapp2.Route(*tuple( r )))
      
    self.apps[app_name].register_urls()


class RozMetaDefault:
  ignore = False
  
  @staticmethod
  def set_defaults(meta):
  
    for member in dir(RozMetaDefault):
      if not hasattr(meta, member):
        setattr(meta, member, getattr(RozMetaDefault, member))

class RozApp:
  
  ROUTES = [
    ('/{{prefix}}/{{app_name}}/', handlers.Manage, 'manage'),
  ]
  
  def __init__(self, app_path):
    
    self.namespace = app_path
    self.name = app_path
    self.verbose_name = util.humanize(self.name)
    
    self._module = util.import_from_string(app_path)
    self._urls_module = util.import_from_string(app_path + '.urls', True)
    self._models_module = util.import_from_string(app_path + '.models', True)
    self._views_module = util.import_from_string(app_path + '.views', True)
    
    self.models = RozModel.get_models(self, self._models_module)
    self.routes = RozEngine.Engine.app_routes


    if hasattr(self._module, 'RozMeta'):
      meta = getattr(self._module, 'RozMeta')
      RozMetaDefault.set_defaults(meta)
    else:
      meta = RozMetaDefault
      
    self._module.RozMeta = meta
    
    for key, value in vars(meta).iteritems():
      util.safe_setattr(self, key, value)
    
    self.register_views()  
    
  def register_urls(self):

    for route in self.routes:
      self.add_url(route)

    for model in self.models.values():
      model.register_urls()
      
  def add_url(self, route, add_defaults=True):
    r = list(route)
    defaults = {'prefix':RozEngine.Engine.admin_path, 'app_name':self.name}
    r[0] = reduce(lambda x, y: x.replace('{{'+y+'}}', defaults[y]), defaults, r[0])
      
    if add_defaults:
      if len(r) < 3:
        r.append(None)
      
      if len(r) < 4: 
        r.append({'app_name':self.name})
      else:
        r[3]['app_name'] = self.name
        
    RozEngine.Engine.webapp.router.add(webapp2.Route(*tuple( r )))
    
  def register_views(self):
    urls = util.safe_getattr(self._views_module, 'urls')
    if urls:
      for url in urls:
        r = list(url)
        if isinstance(r[1], str) and '.' not in r[1]:
          r[1] = self.namespace + '.views.' + r[1]
          
        self.add_url(tuple(r), False)
        

    

class RozModel:

  ROUTES = [
    ('/{{prefix}}/{{app_name}}/{{model_name}}/', handlers.List, 'list'),
    ('/{{prefix}}/{{app_name}}/{{model_name}}/define/', handlers.Define, 'define'),
    ('/{{prefix}}/{{app_name}}/{{model_name}}/list/', handlers.List, 'list'),
    ('/{{prefix}}/{{app_name}}/{{model_name}}/edit/<key_or_id>/', handlers.Edit, 'edit'),
    ('/{{prefix}}/{{app_name}}/{{model_name}}/new/', handlers.Edit, 'new'),
    ('/{{prefix}}/{{app_name}}/{{model_name}}/delete/<key_or_id>/', handlers.Delete, 'delete'),
    
  ]

  @staticmethod
  def get_models(app, models_module):
    models = {}
    
    for model_name, model_class in inspect.getmembers(models_module):
      if inspect.isclass(model_class) and issubclass(model_class, db.Model):
        if hasattr(model_class, 'RozMeta'):
          meta = getattr(model_class, 'RozMeta')
          
          if safe_getattr(meta, 'ignore' , False):
            continue
            
        models[model_name] = RozModel(app, model_class, model_name)
    
    return models

  @staticmethod
  def get_model_fields(model):
    vals = {}
    for p, v in vars(model).iteritems():
      if util.is_serializable(p, v):
        vals[p] = v.__class__.__name__
        
    return vals
  
  @staticmethod  
  def get_model_field_types(model):
    vals = {}
    for p, v in vars(model).iteritems():
      if util.is_serializable(p, v):
        vals[p] = v
    return vals

  
  def __init__(self, app, definition, name):
  
    self._app = app
    self.definition = definition
    self.name = name
    self.verbose_name = util.humanize(self.name)
    self.routes = RozEngine.Engine.model_routes
    
    if hasattr(self.definition, 'RozMeta'):
      meta = getattr(self.definition, 'RozMeta')
      RozMetaDefault.set_defaults(meta)
    else:
      meta = RozMetaDefault
      
    self.definition.RozMeta = meta
    
    for key, value in vars(meta).iteritems():
      util.safe_setattr(self, key, value)
    
    for field_name, field in RozModel.get_model_field_types(self.definition).iteritems():
      if not getattr(field, 'verbose_name'):
        setattr(field, 'verbose_name', util.humanize(field_name))
    
  def register_urls(self):
    for route in self.routes:
      self.add_url(route)
      
  def add_url(self, route, add_defaults=True):
    r = list(route)
    defaults = {'prefix':RozEngine.Engine.admin_path, 'app_name':self._app.name, 'model_name':self.name}
    r[0] = reduce(lambda x, y: x.replace('{{'+y+'}}', defaults[y]), defaults, r[0])

    if add_defaults:
      if len(r) < 3: 
        r.append(None)
      if len(r) < 4:
        r.append({'app_name':self._app.name, 'model_name':self.name})
      else:
        r[3]['app_name'] = self._app.name
        r[3]['model_name'] = self.name
        
    RozEngine.Engine.webapp.router.add(webapp2.Route(*tuple( r )))    
  

