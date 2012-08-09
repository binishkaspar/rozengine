import webapp2
import json
import logging
import inspect
import rozengine
import util
import datetime

from functools import wraps

from webapp2_extras import jinja2
from google.appengine.api import users
from google.appengine.ext import db
from util import RozJSEscapeExtension
from app.models import WebUser, WebGroup


def auth(admin=False):

  def decorator(fn):
    
    @wraps(fn, assigned=util.available_attrs(fn))
    def inner(self, **kwds):
      only_admin = self.permission['only_admin'] if 'only_admin' in self.permission else admin
      
      if not self.user:
        self.redirect(users.create_login_url(self.request.uri))
      else:
        if only_admin and not users.is_current_user_admin():
          self.say_no_rights()
        else:
          fn(self, **kwds)
          
    return inner
    
  return decorator
  
auth_admin = auth(admin=True)

class RozBaseHandler(webapp2.RequestHandler):
  
  
  @webapp2.cached_property
  def rozengine(self):
    return rozengine.RozEngine.Engine
  
  @webapp2.cached_property
  def jinja2(self):
      return jinja2.get_jinja2(app=self.app)

  @webapp2.cached_property
  def admin_jinja2(self):
    key = jinja2._registry_key + 'Admin'
    j = self.app.registry.get(key)
    
    if not j:
      config = jinja2.default_config
      config['template_path'] = self.rozengine.template_path
      config['environment_args']['autoescape'] = False
      
      if 'filters' not in config or config['filters'] == None:
        config['filters'] = {}
      config['filters'].update(RozBaseHandler.jinja_filters())
        
      config['environment_args']['extensions'].append('rozengine.util.RozJSEscapeExtension')
      j = self.app.registry[key] = jinja2.Jinja2(self.app, config)
    
    return j
  
  
  @staticmethod
  def jinja_filters():
    filters = {}
    
    def jsonfy(value):
      return json.dumps(value, cls = util.JSONEncoder) 
    filters['jsonfy'] = jsonfy
    
    return filters
  
  @staticmethod
  def default_respons_contexts():
  
    def user(handler):
      return handler.user
    
    def prefix(handler):
      return handler.rozengine.admin_path
      
    def popout(handler):
      if handler.request.get('popout', None):
        return handler.request.get('popout', '0') == '1'
      return None

    def apps(handler):
      return handler.rozengine.apps
    
    return [
      ('user', '', user),
      ('popout', 'html', popout),
      ('apps', 'html', apps),
      ('prefix', '', prefix)
    ]
  
  def __init__(self, request, response):
    super(RozBaseHandler, self).__init__(request, response)
    
    self.permission = {}
    self.user = self.get_user()
    self.is_admin_user = False
    if self.user:
      self.is_admin_user = users.is_current_user_admin()
            
    self.output_format = self.request.get('ot', 'html').lower()
  
    self.contexts = []
    self.contexts.extend(self.rozengine.DEFAULT_RESPONSE_CONTEXT)
  
  def say_no_rights(self):
    self.render({'user':self.user}, "no_rights.html")
    
  def get_user(self):
    user = users.get_current_user()
    
    if not user:
      return None
  
    webuser = WebUser.all().filter('user =', user).get()
    
    if webuser is None:
      webuser = WebUser(user=user)
      if(hasattr(webuser, 'set_defaults')):
        webuser.set_defaults(self)
        
      webuser.put()
    
    return webuser
    
  def require_login(self):
  
    if not self.user:
      self.redirect(users.create_login_url(self.request.uri))
      return True
      
    return None
  
  def require_admin(self):
    user = self.require_login()
    
    if user:
      if not users.is_current_user_admin():
        self.render({'user':self.user}, "no_rights.html")
        return None
      else:
        return None
    
    return None
  
  def render(self, values, template_name=''):
  
    
    for context in self.contexts:
      (key, format, callback) = context
      
      if key not in values:
        if self.output_format in format.split() or format == '':
          values[key] = callback(self) if callable(callback) else callback
    
    if self.output_format == 'json':
      self.render_json(values, template_name)
    else:
      self.render_template(values, template_name)
      
  def render_template(self, values, template_name):
    self.response.out.write(self.admin_jinja2.render_template(template_name, **values))

  def render_json(self, values, template_name=''):
    #TODO: remove header if available
    self.response.headers.add_header('content-type', 'application/json', charset='utf-8')
    output = json.dumps(values, cls = util.JSONEncoder)
    
    jsback = self.request.get('jsoncallback', '')
    
    if jsback:
      output = ("%s(%s)") % (jsback, output)
      
    self.response.out.write(output)



class JSTemplates(RozBaseHandler):
  
  def get(self, file):
    self.response.content_type = "text/javascript"
    self.render({}, 'js/%s.html.js' % file)


class Dashboard(RozBaseHandler):
  
  @auth_admin
  def get(self):
    self.render({'apps': self.rozengine.apps}, 'dashboard.html')

class Manage(RozBaseHandler):
  
  @auth_admin
  def get(self, app_name):
    app = self.rozengine.apps[app_name]
    models = app.models
    
    vals = {
      'app_name': app_name,
      'models': models
    }
    
    self.render(vals, 'manage.html')

class Define(RozBaseHandler):

  @auth_admin
  def get(self, app_name, model_name):
    
    app = self.rozengine.apps[app_name]
    model = app.models[model_name]
    
    vals = {
      'model': model,
      'app_name': app_name,
      'model_name': model_name
    }
      
    self.render(vals, 'define.html')
        
class List(RozBaseHandler):

  @staticmethod
  def widget(fields=None):
  
    class Widget(List):
      def __init__(self, request, response):
        super(Widget, self).__init__(request, response)
        self.fields = fields
        
    return Widget
  
  def __init__(self, request, response):
    super(List, self).__init__(request, response)
    self.fields = None
  
  @auth_admin    
  def get(self, app_name, model_name):
  
    app = self.rozengine.apps[app_name]
    model = app.models[model_name]
    
    vals = {
      'model': model,
      'app_name': app_name,
      'model_name': model_name,
      'fields': self.fields,
    }
    
    if self.output_format == 'json':
      vals['data'] = model.definition.all().fetch(None)
      
    self.render(vals, 'list.html')
       

class Edit(RozBaseHandler):
  
  FieldMapping = {
    'IntegerProperty': int,
    'FloatProperty': float,
    'BooleanProperty': lambda val: val.lower() == "on",
    'StringProperty': str,
    'TextProperty': db.Text,
    'DateProperty': lambda val: datetime.datetime.strptime(val, '%Y-%m-%d').date(),
    'TimeProperty': lambda val: datetime.datetime.strptime(val, '%M:%S.%f').time(),
    'DateTimeProperty': lambda val: datetime.datetime.strptime(val, '%Y-%m-%dT%M:%S.%f'), #FIXIT: Timezone ?
    'PostalAddressProperty': db.PostalAddress,
    'PhoneNumberProperty': db.PhoneNumber,
    'EmailProperty': db.Email,
    'LinkProperty': db.Link,
    'RatingProperty': db.Rating,
  }
  
  ListFieldMapping = {
    'int':'IntegerProperty',
    'float':'FloatProperty',
    'bool':'BooleanProperty',
    'basestring':'StringProperty',
    
    'date':'DateProperty',
    'time':'TimeProperty',
    'datetime':'DateTimeProperty',
    
    'Text':'TextProperty',
    'PostalAddress':'PostalAddressProperty',
    'PhoneNumber':'PhoneNumberProperty',
    'Email':'EmailProperty',
    'Link':'LinkProperty',
    'Rating':'RatingProperty',

    'User':'UserProperty',
  }


  @staticmethod
  def widget(fields=None, defaults=None, key_or_id=None):
  
    class Widget(Edit):
      def __init__(self, request, response):
        super(Widget, self).__init__(request, response)
        self.fields = fields
        self.defaults = defaults
        self.key_or_id = None if key_or_id is None else str(key_or_id)
        
        action = 'new' if key_or_id is None else 'edit'
        
        self.contexts.append(['action_urls', '', {action:{'url':self.request.path_qs, 'name':action, 'handler': self.__class__.__name__}}]);
        
    return Widget
  
  def __init__(self, request, response):
    super(Edit, self).__init__(request, response)
    self.fields = None
    self.defaults = None
    self.key_or_id = None
  
  def get_parsed_value(self, field_name, field_value, field_class, field=None):

    value = None
    
    if field_class in Edit.FieldMapping:
      value = Edit.FieldMapping[field_class](field_value)
    
    elif field_class == "ReferenceProperty":
      path = (field.reference_class.__module__ + "." + field.reference_class.__name__).split('.')
      
      ref_app_name = ".".join(path[:-2])
      ref_model_name = path[-1]
      ref_app = self.rozengine.apps[ref_app_name]
      ref_model = ref_app.models[ref_model_name]
      value = ref_model.definition.get_by_id(int(field_value))
    
    elif field_class == "ListProperty" or field_class == "StringListProperty":
      value = self.request.POST.getall(field_name)
      
      if field.item_type.__name__ == 'Key':
        result = []
        value_ref = self.request.POST.getall(field_name+"_ref")
        for i in range(len(value)):
          v = value[i]
          r = value_ref[i] #TODO: dont relay on order
          path = v.split('_')
          #TODO: move this RozModel and model using namespace
          app = util.import_from_string(".".join(path[:-1]) + '.models', True)
          model = getattr(app, path[-1])
          ref = model.get_by_id(int(r))
          result.append(ref.key())
          
        value = result
      else:
        class_name = Edit.ListFieldMapping[field.item_type.__name__]
        value = [self.get_parsed_value(field_name, v, class_name) for v in value if len(v) > 0]
      
    elif field_class == "UserProperty":
      # Right now it supports only current user to choose
      if field_value == users.get_current_user().user_id():
        value = users.get_current_user() 
      else:
        value = None
        
    else:
      value = field_value  

        
    return value

  @auth_admin
  def post(self, app_name, model_name, key_or_id=None):
    if self.key_or_id is not None:
      key_or_id = self.key_or_id
    is_new =  key_or_id is None or len(key_or_id) == 0 
      
    app = self.rozengine.apps[app_name]
    model = app.models[model_name]
    
    fields = rozengine.RozModel.get_model_fields(model.definition)
    field_types = rozengine.RozModel.get_model_field_types(model.definition)
    values = {}
    
    if self.fields:
      fields = filter(lambda f: f in self.fields, fields)
      
    if self.defaults:
      for f, v in self.defaults.iteritems():
        values[f] = v
    
    for key, value in self.request.POST.iteritems():
      if key in fields and value is not None and len(value) > 0:
        field = getattr(model.definition, key)
        if field:
          values[key] = self.get_parsed_value(key, value, field.__class__.__name__, field)

    #if 'key_or_id' in self.request.POST and \
    #  self.request.POST['key_or_id'] is not None and \
    #  len(self.request.POST['key_or_id']) > 0:
    if not is_new:  
      data = model.definition.get_by_id(int(key_or_id))
      for key, value in values.iteritems():
        setattr(data, key, value)
    else:
      data = model.definition(**values)

    data.put()
    self.render({'data':data}, '')
  
  @auth_admin 
  def get(self, app_name, model_name, key_or_id=None):

    if self.key_or_id is not None:
      key_or_id = self.key_or_id
    is_new =  key_or_id is None or len(key_or_id) == 0 
    
    app = self.rozengine.apps[app_name]
    model = app.models[model_name]
    
    vals = {
      'model': model,
      'app_name': app_name,
      'model_name': model_name,
      'is_edit': not is_new,
      'key_or_id': key_or_id,
      'fields': self.fields,
      'defaults': self.defaults,
    }
    
    if not is_new and self.request.get('ot', '').lower() == 'json':
      vals['data'] = model.definition.get_by_id(int(key_or_id))
      
    self.render(vals, 'edit.html')
  
class Delete(RozBaseHandler):
  @auth_admin
  def get(self, app_name, model_name, key_or_id):
    app = self.rozengine.apps[app_name]
    model = app.models[model_name]
    
    item = model.definition.get_by_id(int(key_or_id))
    item.delete()
    self.render({'status':True, 'key_or_id':key_or_id}, '')