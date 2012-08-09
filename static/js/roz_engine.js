var RozEngine = {};
RozEngine.VERSION = 0.1;

RozEngine.Cache = {
  Apps: {},
  ModelList:{},
  Models: {},
  FieldIndex: {},
  FormFields: {},
  FieldSampleData: {},
  Counters: {},
  ActionUrls: {},
};

RozEngine.DataTypesMapping = {
  'IntegerProperty': 'number',
  'FloatProperty': 'number',
  'BooleanProperty': 'checkbox',
  'StringProperty': 'text',
  'TextProperty': 'text',
  'DateProperty': 'date',
  'TimeProperty': 'time',
  'DateTimeProperty': 'datetime',
  'PostalAddressProperty': 'text',
  'PhoneNumberProperty': 'tel',
  'EmailProperty': 'email',
  'UserProperty': 'text',
  'LinkProperty': 'url',
  'RatingProperty': 'number',
  'StringListProperty': 'text',
  'ListProperty': 'text',
  'Key': 'hidden',
  '__internal__': 'hidden',
  '__keys_property__': 'text',
  'ReferenceProperty': 'text',
};

RozEngine.ListDataTypesMapping = {
  '__builtin__.int':'IntegerProperty',
  '__builtin__.float':'FloatProperty',
  '__builtin__.bool':'BooleanProperty',
  '__builtin__.basestring':'StringProperty',
  
  'datetime.date':'DateProperty',
  'datetime.time':'TimeProperty',
  'datetime.datetime':'DateTimeProperty',
  
  'google.appengine.api.datastore_types.Text':'TextProperty',
  'google.appengine.api.datastore_types.PostalAddress':'PostalAddressProperty',
  'google.appengine.api.datastore_types.PhoneNumber':'PhoneNumberProperty',
  'google.appengine.api.datastore_types.Email':'EmailProperty',
  'google.appengine.api.datastore_types.Link':'LinkProperty',
  'google.appengine.api.datastore_types.Rating':'RatingProperty',
  
  'google.appengine.api.datastore_types.Key': '__keys_property__',
  'google.appengine.api.users.User':'UserProperty',
};

RozEngine.ParsedData = function(rawdata){

  //FIXIT: ugly way of checking the user object
  if(rawdata['user_id'] && rawdata['nickname'] && !( rawdata['key_or_id'] || rawdata['__str__'] )){
    rawdata['__str__'] = rawdata['nickname'];
  }

  for(var r in rawdata){
    this[r] = rawdata[r];
  }
};

RozEngine.Counter = function(index){
  this.index = index || 0;
  this.next = this.next_index.bind(this);
};

RozEngine.Counter.prototype.next_index = function(){
  return this.index++;
}

RozEngine.MustacheData = function(object, key_name, value_name){
  keyname = key_name || 'key';
  valuename = value_name || 'value';
  
  var data = [];
  for(var key in object){
    var o = {};
    o[keyname] = key;
    o[valuename] = object[key];
    data.push(o);
  }
  
  return data;
};


RozEngine.ParsedData.prototype.toString = function(){
  return this.__str__ || this.name || this;
};

RozEngine.Widgets = {};
RozEngine.Widgets.List = function(app_name, model_name, element, params){
  var request = new RozEngine.Request.List(app_name, model_name, params);
  request.run(function(html){
    element.innerHTML += html;
  });
};

RozEngine.Request = Class.extend({
  
  init: function(app_name, model_name, params, action){
    params = params || {};
    
    this.app_name = app_name;
    this.model_name = model_name;
    this.action = action || 'define';
    this.require_definition = params.require_definition || true;
    this.key_or_id = params.key_or_id;
    this.fields = params.fields || null;
    this.action_urls = params.action_urls || {};
    this.admin_path = params.admin_path || '/admin';
    
    this.handle_view = (params.handle_view == undefined ? true : params.handle_view);
    
    this.namespace = this.create_namespace(app_name, model_name);
    
    this._field_indexes = null;

    
  },

  create_namespace: function(app_name, model_name){
    return (app_name + '.' + model_name).replace(/\./g, '_');
  },
  
  get_action_url: function(action, key_or_id, output){
  
    action = action || this.action;
    key_or_id = key_or_id || this.key_or_id;
    output = output || 'json';

    console.log(action, '>', this.action_urls);
            
    if(this.action_urls[action] 
      || (RozEngine.Cache.ActionUrls[this.namespace]
      && RozEngine.Cache.ActionUrls[this.namespace][action])){
      
      var url = this.action_urls[action] || RozEngine.Cache.ActionUrls[this.namespace][action];
      url = url.url.replace('<key_or_id>', key_or_id);
      if(output != 'html'){
        url += "?ot=" + output;
      }
      
      return url; 
    }
    
    var url = [this.admin_path, this.app_name, this.model_name];
    url.push(action);
    if(action == ''){url = [this.admin_path];}
    return url.join('/') + ((key_or_id)?"/"+key_or_id:"") + ((output=='html')?"/":"/?ot=" + output);
  },
  
  set_data: function(raw_data){
    this.data = raw_data;
    this.admin_path = this.data.prefix;
    
    //for(var d in this.data){
    //  this.data[d] = new RozEngine.ParsedData(this.data[d]);
    //}
  },
  
  set_model_data: function(app_name, model_name, data){
    var definition = data.definition;
    var namespace = this.create_namespace(app_name, model_name);
    var index = [];
    var order = [];
    var ordered_index = [];
    
    for(var key in definition){
      var type = definition[key];
      index.push({key:key, type:type, verbose_name:(type.verbose_name || key)});
      var c = type.creation_counter;
      order.push(c);
    }
    
    order.sort();
    
    for(var i in index){
      var type = index[i];
      var ind = order.indexOf(type.type.creation_counter)
      ordered_index[ind] = type;
    }
    
    if(data.routes){
      var action_urls = {};
      
      for(var i = 0, route=null; route=data.routes[i]; i++){  
        if(! action_urls[route[2]]){
          var url = {'url':route[0], 'handler':route[1], 'name':route[2]};
          url.url = Mustache.render(url.url, {'app_name':app_name, 'model_name': model_name, 'prefix':this.admin_path});
          action_urls[route[2]] = url; 
        }
      }
      
      RozEngine.Cache.ActionUrls[namespace] = action_urls;
    }

    RozEngine.Cache.FieldIndex[namespace] = ordered_index;
    RozEngine.Cache.FieldSampleData[namespace] = {};    
  },

  get_field_indexes: function(){
    if(this._field_indexes){
      return this._field_indexes;
    }
    
    var fields = RozEngine.Cache.FieldIndex[this.namespace];
    if(this.fields){
      var result = [];
      for(var i in fields){
        if(this.fields.indexOf(fields[i].key) > -1){
          result.push(fields[i]); 
        }
      }
      
      this._field_indexes = result;
      return result;
      
    }
    
    this._field_indexes = fields;
    return fields;
  },

  get_parsed_row_data: function(data){
  
    var index = this.get_field_indexes();
    var fields = [];
    
    for(var j in index){
      var key = index[j].key;
        
      var value = data[key];
      
      if(value instanceof Array){
        var str = [];
        for(var v in value){
          if(value[v] instanceof Object){
            str.push((new RozEngine.ParsedData(value[v])).toString() );
          }else{
            str.push(value[v]);
          }
        }
        value = str.join(',');
      }
      
      if(value instanceof Object){
        value = new RozEngine.ParsedData(value);
      }
      
      fields.push({key:key, value:value});
    }
    
    return {namespace:this.namespace, fields:fields, key_or_id:data.key_or_id, edit_url:this.get_action_url('edit', data.key_or_id, 'html')};
  },

  run: function(callback){

    if(RozEngine.Cache.Apps[this.app_name] == undefined && this.action != 'define' && this.action != ''){
      var def_request = new RozEngine.Request.AppsInfo();
      def_request.run(this.run.bind(this, callback));    
    }else{
      
      var url = this.get_action_url();
      
      $.getJSON(url, this.on_run.bind(this, callback));    
    }
    
  },
  
  on_run: function(callback, data, status, event){
  
    if(status && status == "success"){
      this.set_data(data);
      this.handle(callback, this.data);
    }else{
      alert('Error while processing');
      callback(data);
    }  
  },
  
  handle: function(callback, data){
    this.on_run_completed(callback, data);
  },
  
  on_run_completed: function(callback, result){
    if(callback) callback.call(undefined, result);
    
    this.enable_events();
  },
  
  enable_events: function(){},
  on_events: function(event){},
  on_event_completed: function(){},
  
});


RozEngine.Request.AppsInfo = RozEngine.Request.extend({
  
  init: function(params){
    this._super('', '', params, '');
    this.action = '';
  },

  set_data: function(data){
    this._super(data);
    for(var app_name in data.apps){
      var app = data.apps[app_name];
      for(var model_name in app.models){
        this.set_model_data(app_name, model_name, app.models[model_name]);
        RozEngine.Cache.ModelList[this.create_namespace(app_name, model_name)] = app.models[model_name].verbose_name;
      }
    }    
    RozEngine.Cache.Apps = this.data.apps;
  },

});

RozEngine.Request.AppsInfo.Run = function(params, callback){
  var request = new RozEngine.Request.AppsInfo(params);
  request.run(callback);   
};

RozEngine.Request.Define = RozEngine.Request.extend({
  init: function(app_name, model_name, params){
    this._super(app_name, model_name, params, 'define');
  },
  
  set_data: function(data){
    this._super(data);
    this.set_model_data(this.app_name, this.model_name, this.data.model);
  },
  
});

RozEngine.Request.Define.Run = function(app_name, model_name, params, callback){
  var request = new RozEngine.Request.Define(app_name, model_name, params);
  request.run(callback);   
};


RozEngine.Request.List = RozEngine.Request.extend({
  init: function(app_name, model_name, params){
    this._super(app_name, model_name, params, 'list');
  },
  
  handle: function(callback, data){
    if(! this.handle_view ){
      this.on_run_completed(callback, data);
      return;
    }
  
    var params = {};
    params.namespace = this.namespace;
    params.fields = this.get_field_indexes();
    params.fields_count = params.fields.length+1;
    params.rows = [];
    
    for(var i in this.data.data){
      var d = this.data.data[i];
      var row_html = Mustache.render(RozEngine.Templates.ListRow, this.get_parsed_row_data(d, this.fields));
      params.rows.push(row_html);
    }
    
    var html = Mustache.render(RozEngine.Templates.List, params);
    
    this.on_run_completed(callback, html);
  },
  
  enable_events: function(){
    if(! this.handle_view ){
      return;
    }
    
    $('[name="action_' + this.namespace + '_remove"]').click(this.on_events.bind(this, 'remove'));
    //$('[name="action_' + this.namespace + '_edit"]').click(this.on_events.bind(this, 'edit'));
  },
  
  on_events: function(event_name, event){
    if(! this.handle_view ){
      return;
    }
    
    event.preventDefault();
    var id = event.currentTarget.dataset.id;
    
    if(event_name == 'remove'){
      var request = new RozEngine.Request.Delete(this.app_name, this.model_name, {key_or_id:id});
      request.run(this.on_event_completed.bind(this, event_name));
    }else if(event_name == 'edit'){
      
    }
    
  },
  
  on_event_completed: function(event_name, data, success){
    if(! this.handle_view ){
      return;
    }
  
    if(event_name == 'remove'){
      $('#data_' + this.namespace + '_' + data.key_or_id).remove()
    }else if(event_name == 'edit'){
    
    } 
  },
  
});

RozEngine.Request.List.Run = function(app_name, model_name, params, callback){
  var request = new RozEngine.Request.List(app_name, model_name, params);
  request.run(callback);   
};

RozEngine.Request.List.LoadOnListBox = function(app_name, model_name, element_id, type, default_value){
  
  RozEngine.Request.List.Run(app_name, model_name,  {handle_view: false}, (function(element_id, type, default_value, data){
    var element = document.getElementById(element_id);  
    
    if( !type.required ){
      element.innerHTML += Mustache.render(RozEngine.Templates.Option, {'value':'', 'name':'Select a value'});
    }
    
    for(var j in data.data){
      var val = data.data[j];
      val = new RozEngine.ParsedData(val);
      element.innerHTML += Mustache.render(RozEngine.Templates.Option, 
        {'value':val.key_or_id, 'name':val, 'selected':(default_value == val.key_or_id)});
    }
  }).bind(undefined, element_id, type, default_value));
};

RozEngine.Request.New = RozEngine.Request.extend({
  
  init: function(app_name, model_name, params){
    this._super(app_name, model_name, params, 'new');
    this._load_events = [];
  },
  
  handle: function(callback, data){
    var child = [];
    var edit_data = data.data;
    var is_edit = data.is_edit;
  
    var fields = this.get_field_indexes();
    for(var i in fields){
    
      var key = fields[i].key;
      var type = RozEngine.Cache.Apps[this.app_name].models[this.model_name].definition[key];
      
      if(type.auto_now || type.auto_now_add){ continue; }
        
      var html = this.create_field_html(type, key, is_edit, edit_data);
      child.push(html);
    }
  
    child.push(Mustache.render(RozEngine.Templates.FormAction, {}));
    
    var html = child.join('');
    var output = Mustache.render(RozEngine.Templates.Form, {'content':html, 'namespace':this.namespace});
    
    
    this.on_run_completed(callback, output);
  },
  
  create_field_data: function(type, key, is_edit, edit_data, parent){

    var default_value = type.default;
    var data = {};
    
    data.attr = [];
    data.element = 'input'
    data.namespace = this.namespace;
    data.label = type.verbose_name || key;
    data.name = key;
    data.attr.push({key:'name', value:key});
    data.has_choice = false;
    data.default_list = null;
    
    if(! RozEngine.Cache.Counters[this.namespace+"_"+key]){
      RozEngine.Cache.Counters[this.namespace+"_"+key] = new RozEngine.Counter();
    }
    data.counter = RozEngine.Cache.Counters[this.namespace+"_"+key];
    

    if(RozEngine.DataTypesMapping[type.dbtype]){
      data.attr.push({key:'type', value:RozEngine.DataTypesMapping[type.dbtype]});
    }else{
      data.attr.push({key:'type', value:'text'});
    }
    
    if(is_edit){
      default_value = edit_data[key];
      if(default_value instanceof Array){
        default_value = default_value;
      }else if(default_value instanceof Object){
        default_value = default_value.key_or_id || default_value.user_id;
      }
      
    }

    if(type.required) data.attr.push({key:'required', value:"required"});
    
    data.choices = type.choices;

          
    switch(type.dbtype){
    
      case 'StringProperty':
        data.attr.push({key:'maxlength', value:500});
        if(type.multiline) data.element = 'textarea';
        break;
      
      case 'TextProperty':
        data.element = 'textarea'
        break;

      case 'BooleanProperty':
        if(default_value){data.attr.push({key:'checked', value:"yes"});}
        break;
      
      case 'RatingProperty':
        data.attr.push({key:'min', value:0});
        data.attr.push({key:'max', value:100});
        break;
      case 'ReferenceProperty':
        data.has_select = true;
        data.element = 'select';
        data.list_id = "inp_" + this.namespace + "_" + key;
        this._load_events.push({id:data.list_id, type:type, default_value:default_value});
        break;
      case 'StringListProperty':
      case 'ListProperty':
      
        data.default_list = [];

        if(default_value){
          for(var i=0; i<default_value.length; i++){
            var t = Object.clone(type);
            t.default = default_value[i];
            t.dbtype = RozEngine.ListDataTypesMapping[t.item_type] || 'StringProperty';
            var d = this.create_field_data(t, key, false, edit_data, data);
            d.in_list = true;
            d.has_list = false;
            data.default_list.push(d);
          }
        }
        
        data.has_list = true;
        var t = Object.clone(type);
        t.required = false;
        t.dbtype = RozEngine.ListDataTypesMapping[t.item_type] || 'StringProperty';
        t.default = '';
        RozEngine.Cache.FieldSampleData[this.namespace][key] = Object.clone(t);
        var d = this.create_field_data(t, key, false, {}, data);
        
        if(t.item_type == 'google.appengine.api.datastore_types.Key'){
          d['special_type'] = true;
        }
        
        data.default_list.push(d);

        break;
      case 'UserProperty':
        data.has_select = true;
        data.element = 'select';
        data.list_id = "inp_" + this.namespace + "_" + key;
        data.choices = [{value:'', name:"No One"}, {value:this.data.user.user.user_id, name:this.data.user.user.nickname}];
        if(default_value == this.data.user.user.user_id){
          data.choices[1]['selected']=true;
        }
        break;
      case '__keys_property__':
        data.has_select = true;
        data.has_ref = true;
        data.element = 'select';
        
        data.choices = RozEngine.MustacheData(RozEngine.Cache.ModelList, 'value', 'name');
        data.choices.unshift({'value':'', 'name':'Select a value'});
        var list_box_id = 'inp_'+ this.namespace +'_'+ key +'_ref_0';
        
        $('#inp_'+ this.namespace +'_'+ key+'').live('change', (function(list_box_id, type, event){
          var val = $(event.currentTarget).val();
          var parts = val.split('_');
          
          var apppath = [];
          for(var j=0; j < parts.length-1; j++){
            apppath.push(parts[j]);
          }
          
          RozEngine.Request.List.LoadOnListBox(apppath.join('.'), parts[parts.length-1], list_box_id, type, null);
          
        }).bind(this, list_box_id, type));
        break;
      case 'Key':
      case '__internal__':
        //data.type = "hidden";
        data.hidden = true;
        break;
    }

    if(default_value){
      if(data.element == 'textarea'){
        data.value = default_value;
      }else{
        data.attr.push({key:'value', value:default_value});
      }
    }
          
    if(type.choices){
      data.list_id = "list_" + this.namespace + "_" + key;
      data.attr.push({key:'list', value:data.list_id});
      data.has_choice = true;
    }
    
    if(! data.default_list){
      data.default_list = [data];
    }
    
    return data;  
  },
  
  create_field_html: function(type, key, is_edit, edit_data){
    var data = this.create_field_data(type, key, is_edit, edit_data);
    return Mustache.render(RozEngine.Templates.Field, data, {'fieldcontrol':RozEngine.Templates.FieldControl});
  },
  
  enable_events: function(){
    $('#form_' + this.namespace).submit(this.on_events.bind(this, 'save'));
    
    for(var i in this._load_events){
      var event = this._load_events[i];
      var parts = event.type.reference_class.split('.');
      var apppath = [];
      for(var j=0; j < parts.length-2; j++){
        apppath.push(parts[j]);
      }

      RozEngine.Request.List.LoadOnListBox(apppath.join('.'), parts[parts.length-1], event.id, event.type, event.default_value);
    }
    
    $('[name="action_remove_a_value"]').live('click', (function(event){
      event.preventDefault();
      var ele = event.currentTarget.parentElement;
      $(ele).remove();
      //$('#inpctrl_' + ele.dataset.namespace + '_' + ele.dataset.name).remove();
    
    }).bind(this));
    
    $('[name="action_add_a_value"]').live('click', (function(event){
      event.preventDefault();
      var ele = event.currentTarget;
      
      var ns = ele.dataset.namespace;
      var name = ele.dataset.name;
      var original = RozEngine.Cache.FieldSampleData[ns][name];
      var sample = Object.clone(original); 
      
      var pele = ele.parentElement;
      var jele = $(pele).children('[name="'+ name +'"]');
      var val = jele.val();
      jele.val(sample.default);
      sample.default = val;
      
      var data = this.create_field_data(sample, name, false, null);
      data.in_list = true;
      data.has_list = false;
      
      var ref_val = null;
      if(ele.dataset.special_type){
        var ref_ele = document.getElementById(jele[0].id + '_ref_0');
        ref_val = $(ref_ele).val();
        
        data.default_ref_value = ref_ele.innerHTML;
        for(var i=0; i<data.choices.length; i++){
          if(data.choices[i]['value'] == val){
            data.choices[i]['selected'] = true;
          }
        }
        
        $(ref_ele).html('');
        //ref_ele.innerHtml = '';
      }
      
      console.log(ref_val);
      var html = Mustache.render(RozEngine.Templates.FieldControl, data);      
      var newele = $(pele).before(html);

    }).bind(this));
    
  },
  
  on_events: function(event_name, event){
    event.preventDefault();
    var handler = $.post(this.get_action_url(), $('#form_' + this.namespace).serialize(), this.on_event_completed.bind(this, event_name), 'json');
  },
  
  on_event_completed: function(event, data, success){
    
    if(success){
      var element = document.getElementById('list_body_' + this.namespace);
      if(element){
        var html = Mustache.render(RozEngine.Templates.ListRow, this.get_parsed_row_data(data.data));
        element.innerHTML += html;
      }else{
        alert('Saved');
      }
      
      var form_fields = $('[id^="inp_' + this.namespace + '_"]');
      
      for(var i=0; i<form_fields.length; i++){
        var field = form_fields[i];
        $(field).val(field.dataset.default);
      }
      
      
    }else{
      alert('Error while reading');  
    }
      
  },
  
});

RozEngine.Request.New.Run = function(app_name, model_name, params, callback){
  var request = new RozEngine.Request.New(app_name, model_name, params);
  request.run(callback);   
};

RozEngine.Request.Edit = RozEngine.Request.New.extend({
  
  init: function(app_name, model_name, params){
    this._super(app_name, model_name, params);
    this.action = 'edit';
  },

});

RozEngine.Request.Edit.Run = function(app_name, model_name, params, callback){
  var request = new RozEngine.Request.Edit(app_name, model_name, params);
  request.run(callback);   
};

RozEngine.Request.Delete = RozEngine.Request.extend({
  init: function(app_name, model_name, params){
    this._super(app_name, model_name, params, 'delete');
  },
});

RozEngine.Request.Delete.Run = function(app_name, model_name, params, callback){
  var request = new RozEngine.Request.Delete(app_name, model_name, params);
  request.run(callback);   
};



/***************** Utils ***************/
Object.clone = function(obj) {

    if (null == obj || "object" != typeof obj) return obj;

    // Handle using static copy method if available
    if(obj.copy){
        return obj.copy();
    }

    // Handle Object
    if (
        (obj instanceof RegExp) 
        || (obj instanceof Boolean)
        || (obj instanceof Number)
        || (obj instanceof String)
        || (obj.constructor && obj.constructor.prototype === obj)
    ) {
        return obj;
    }
    
    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0, len = obj.length; i < len; ++i) {
            copy[i] = Object.clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = Object.clone(obj[attr]);
        }
        return copy;
    }
    
    throw new Error("Unable to copy obj! Its type isn't supported.");
}

Object.shallowCopy = function(object){
    var n = {};
    var keys = Object.keys(object);
    for(var i in keys){
        var key = keys[i];
        n[key] = object[key];
    }
    
    return n;
}

Object.merge = function(object, default_object){
    var new_default_object = Object.clone(default_object);
    Object.update(new_default_object, object)
    return new_default_object;
}

Object.update = function(self, new_object){
    
    for(var key in new_object){
        var v = new_object[key];
        
        if( 
            (v instanceof Object) 
            && (key in self)
            && !(v instanceof Array)
            && !(v instanceof Date) 
            && !(v instanceof RegExp)
            && !(v instanceof Boolean)
            && !(v instanceof Number)
            && !(v instanceof String)
            && !(v.constructor && v.constructor.prototype === v)
        ){
            if(self[key] == null){
                self[key] = {};
            }
            
            Object.update(self[key], v);
            
        }else{
            self[key] = Object.clone(v);
        }
        
    }

}
