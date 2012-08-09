if(! RozEngine.hasOwnProperty('Templates')){
  RozEngine.Templates = {}
}

RozEngine.Templates.Form = '{% rozjsescape %}{% raw -%}
<form class="form-horizontal" id="form_{{namespace}}" method="post">
  {{{content}}}
</form>
{%- endraw %}{% endrozjsescape -%}
';


RozEngine.Templates.FormAction = '{% rozjsescape %}{% raw -%}
<div class="form-actions">
  <button type="submit" class="btn btn-primary">Save changes</button>
  <button class="btn">Cancel</button>
</div>
{%- endraw %}{% endrozjsescape -%}';


RozEngine.Templates.Field = '{% rozjsescape %}{% raw -%}
<div class="control-group {{#hidden}}hidden{{/hidden}}" id="{{namespace}}_{{name}}" >
  <label class="control-label {{lbl_class}}" for="inp_{{namespace}}_{{name}}">{{label}}</label>
  
  {{#default_list}}
    {{> fieldcontrol}}
  {{/default_list}}
  
  {{#has_choice}}
    <datalist id="{{list_id}}">
      {{#choices}}
        <option value="{{.}}">
      {{/choices}}
    </datalist>
  {{/has_choice}}

</div>
{%- endraw %}{% endrozjsescape -%}';


RozEngine.Templates.FieldControl = '{% rozjsescape %}{% raw -%}
    <div 
      class="controls"
      id="inpctrl_{{namespace}}_{{name}}"
      data-name="{{name}}"
      data-namespace="{{namespace}}">
      
      <{{element}} 
        class="input-xlarge focused {{inp_class}}" 
        id="inp_{{namespace}}_{{name}}{{#in_list}}_{{counter.next}}{{/in_list}}" 
        {{#multiple}}multiple="multiple"{{/multiple}}
        {{#attr}} {{key}}="{{value}}" {{/attr}}
        {{#sattr}} {{.}} {{/sattr}}>{{#has_select}}
            {{#choices}}
              <option 
                value="{{value}}" 
                {{#selected}}selected="selected"{{/selected}}>
                  {{name}}
              </option>
            {{/choices}}
          {{/has_select}}{{^has_select}}{{value}}{{/has_select}}</{{element}}>
      
      {{#has_ref}}
        <select 
          class="input-xlarge focused {{inp_class}}" 
          id="inp_{{namespace}}_{{name}}_ref_{{counter.index}}"
          name="{{name}}_ref">{{{default_ref_value}}}</select>
      {{/has_ref}}
      
      {{#in_list}}
        <a 
          data-name="{{name}}"
          data-namespace="{{namespace}}"
          class="btn btn-danger btn-mini"
          name="action_remove_a_value"
          alt="Remove"
          data-id="{{key_or_id}}">
            <i class="icon-trash icon-white"></i>
        </a>
      {{/in_list}}
      
      {{#has_list}}
        <a 
          data-name="{{name}}"  
          data-namespace="{{namespace}}"
          {{#special_type}}data-special_type="keylist"{{/special_type}} 
          class="btn btn-success btn-mini" 
          name="action_add_a_value"  
          alt="Add" 
          data-id="{{key_or_id}}">
            <i class="icon-plus icon-white"></i>
        </a>
      {{/has_list}}
    </div>
{%- endraw %}{% endrozjsescape -%}';

RozEngine.Templates.List = '{% rozjsescape %}{% raw -%}
<table class="table table-striped table-bordered" id="list_{{namespace}}">
  <thead>
    <tr>
      {{#fields}}
      <th data-key="{{key}}" data-type="{{type}}">{{verbose_name}}</th>
      {{/fields}}
      <th></th>
    </tr>
  </thead>
  <tbody id="list_body_{{namespace}}">
    {{#rows}}
      {{{.}}}
    {{/rows}}
    {{^rows}}
      <tr><td colspan="{{fields_count}}" style="text-align:center">No Records found !!!</td></tr>
    {{/rows}}    
  </tbody>
</table>
{%- endraw %}{% endrozjsescape -%}';


RozEngine.Templates.ListRow = '{% rozjsescape %}{% raw -%}
  <tr id="data_{{namespace}}_{{key_or_id}}">
    {{#fields}}
    <td data-key="{{key}}">{{value}}</td>
    {{/fields}}
    <td><span style="float:right">
      <a class="btn btn-primary" name="action_{{namespace}}_edit" alt="Edit" href="{{edit_url}}"><i class="icon-edit icon-white"></i></a>
      <a class="btn btn-danger" name="action_{{namespace}}_remove"  alt="Remove" data-id="{{key_or_id}}"><i class="icon-trash icon-white"></i></a>
    </span></td>
  </tr>
{%- endraw %}{% endrozjsescape -%}';

RozEngine.Templates.Option = '{% rozjsescape %}{% raw -%}
<option value="{{value}}" {{#selected}}selected="selected"{{/selected}}>{{name}}</option>
{%- endraw %}{% endrozjsescape -%}';