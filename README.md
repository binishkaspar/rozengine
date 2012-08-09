RozEngine
=========
Simple Admin Interface and REST API for Google App Engine Python

Introduction
------------
RozEngine provides simple admin interface and rest api for google app engine. Its build on top webapp2 which comes with google app engine. And jinja2 is used as template engine for it.

> This library is in development stage, please don't use it for production


Folder Structure
----------------
Folder structure is smiler to djnago.

    \- main.py -> startup script
    \- app_name -> name of the app
       \- models.py -> Model definition
       \- views.py -> Views and url definition
       \- __init__.py -> Some meta information about the app


Usage
-----

Download the source code keep it in the project root folder
Add the follwing handlers in `app.yaml`

    - url: /rozengine_static
      static_dir: rozengine/static
    
Enable following libraries in `app.yaml`

    libraries:
    - name: webapp2
      version: "2.5.1"
    - name: jinja2
      version: latest

Create a test app, create new folder `"testapp"` with the following files

    - __init__.py
    - models.py
    - views.py
  
In `models.py` add the follwing code

    from google.appengine.ext import db  
    class TestModel(db.Model):
      name = db.StringProperty()
      created = db.DateTimeProperty(auto_now_add=True)
      modified = db.DateTimeProperty(auto_now=True)
    
Now import and start the engine, in `main.py` 

    import webapp2
    import rozengine
    app = webapp2.WSGIApplication([], debug=True) 
    engine = rozengine.register_apps([
      'testapp', # app names
    ])
  
  
Now run the project and open `"/admin/"` url