from google.appengine.ext import db
from google.appengine.api import users

class WebUser(db.Model):
  user = db.UserProperty()
  
  active = db.BooleanProperty()
  is_admin = db.BooleanProperty()
  groups = db.ListProperty(db.Key)

  created = db.DateTimeProperty(auto_now_add=True)
  modified = db.DateTimeProperty(auto_now=True)
  
  
  def __str__(self):
    return self.name
  
  @property
  def name(self):
    if self.user:
      return self.user.nickname()
    return ''
  
  @property
  def logout_url(self):
    return users.create_logout_url("/")
    
  @property
  def set_defaults(self, request):
    self.is_admin = users.is_current_user_admin()
    self.active = True

  def to_dict(self):
     return dict([(p, unicode(getattr(self, p))) for p in self.properties()])

  class RozMeta:
    verbose_name = "Web User"
     
class WebGroup(db.Model):
  name = db.StringProperty()
  description = db.TextProperty()
  tags = db.StringListProperty()

  created = db.DateTimeProperty(auto_now_add=True)
  modified = db.DateTimeProperty(auto_now=True)


  def __str__(self):
    return self.name
      
  @property
  def users(self):
    return UserInfo.gql("where groups = :1", self.key())
    
    
  class RozMeta:
    verbose_name = "Web Group"