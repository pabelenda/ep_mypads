/**
*  # Subscription module
*
*  ## License
*
*  Licensed to the Apache Software Foundation (ASF) under one
*  or more contributor license agreements.  See the NOTICE file
*  distributed with this work for additional information
*  regarding copyright ownership.  The ASF licenses this file
*  to you under the Apache License, Version 2.0 (the
*  "License"); you may not use this file except in compliance
*  with the License.  You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing,
*  software distributed under the License is distributed on an
*  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
*  KIND, either express or implied.  See the License for the
*  specific language governing permissions and limitations
*  under the License.
*
*  ## Description
*
*  This module contains the subscription logic and markup.
*/

module.exports = (function () {
  // Dependencies
  var ld = require('lodash');
  var m = require('mithril');
  // Local Dependencies
  var conf = require('../configuration.js');
  var form = require('../helpers/form.js');
  var model = require('../model/group.js');
  var notif = require('../widgets/notification.js');
  var auth = require('../auth.js');
  var layout = require('./layout.js');
  var user = require('./user.js');

  var subscribe = {};

  /**
  * ## Controller
  *
  * Used for module state and actions and form submission.
  * `initFields` is called to track the status of all fields.
  * According to `profileView` getter-setter, we add or remove fields and
  * populate values with local values.
  */

  subscribe.controller = function () {
    var c = { adminView: m.prop(false) };
    c.profileView = m.prop((m.route() === '/myprofile'));
    document.title = (c.profileView() ? conf.LANG.USER.PROFILE :
      conf.LANG.USER.SUBSCRIBE);
    document.title += ' - ' + conf.SERVER.title;
    if (c.profileView() && !auth.isAuthenticated()) {
      conf.unauthUrl(true);
      return m.route('/login');
    }
    c.fields = ['login', 'password', 'passwordConfirm', 'email', 'firstname',
      'lastname', 'organization', 'lang', 'color'];
    if (c.profileView()) {
      c.fields.push('passwordCurrent', 'useLoginAndColorInPads');
    }
    form.initFields(c, c.fields);
    if (c.profileView()) {
      ld.map(c.fields, function (f) {
        if (!ld.startsWith(f, 'password')) {
          c.data[f] = m.prop(auth.userInfo()[f]);
        }
      });
    } else {
      c.data.lang = m.prop(conf.USERLANG);
    }

    /**
    * ### submit
    *
    * Submissions of forms.
    * `errfn` helper with error notification
    */

    var errfn = function (err) {
      return notif.error({ body: ld.result(conf.LANG, err.error) });
    };

    c.submit = {};

    /**
    * #### submit.subscribe
    *
    * `submit.subscribe` internal calls the public API to subscribe with given
    * data :
    *
    * - it ensures that additionnal validity check is done;
    * - it displays errors if needed or success and fixes local cached data for
    * the user;
    * - it also updates UI lang if needed;
    * - finally, it authenticates new created user.
    */

    c.submit.subscribe = function (e) {
    };

    /**
    * #### submit.profileSave
    *
    * This function :
    *
    * - uses the public API to check if given `passwordCurrent` is valid;
    * - then updates data as filled, taking care of password change with the
    *   help of the `passwordUpdate` function;
    * - notifies *errors* and *success*;
    * - updates the local cache of `auth.userInfo`.
    */

    c.submit.profileSave = function (e) {
      e.preventDefault();
      var passwordUpdate = function () {
        var pass = c.data.password();
        if (!pass || (pass !== c.data.passwordConfirm())) {
          c.data.password(c.data.passwordCurrent());
        }
      };
      m.request({
        method: 'POST',
        url: conf.URLS.CHECK,
        data: {
          login: auth.userInfo().login,
          password: c.data.passwordCurrent,
          auth_token: auth.token()
        }
      }).then(function () {
        passwordUpdate();
        m.request({
          method: 'PUT',
          url: conf.URLS.USER + '/' + auth.userInfo().login,
          data: ld.assign(c.data, { auth_token: auth.token() })
        }).then(function (resp) {
          auth.userInfo(resp.value);
          notif.success({ body: conf.LANG.USER.AUTH.PROFILE_SUCCESS });
        }, errfn);
      }, errfn);
    };

    /**
    * #### removeAccount
    *
    * This function :
    *
    * - inform the user about that no return will be possible
    * - asks for the current password and checks it
    * - remove the user and its groupds and pads, server-side
    * - logout the user
    * - and redirects him to the homepage
    */

    c.removeAccount = function () {
      var password = window.prompt(conf.LANG.USER.INFO.REMOVE_ACCOUNT_SURE);
      if (password) {
        var login = auth.userInfo().login;
        m.request({
          method: 'POST',
          url: conf.URLS.CHECK,
          data: {
            login: login,
            password: password,
            auth_token: auth.token()
          }
        }).then(function () {
          m.request({
            method: 'DELETE',
            url: conf.URLS.USER + '/' + login,
            data: { auth_token: auth.token() }
          }).then(function () {
            localStorage.removeItem('token');
            auth.userInfo(null);
            model.init();
            document.title = conf.SERVER.title;
            m.route('/');
            notif.success({
              body: conf.LANG.USER.INFO.REMOVE_ACCOUNT_SUCCESS
            });
          }, errfn);
        }, errfn);
      }
    };

    return c;
  };

  /**
  * ## Views
  */

  var view = {};
  subscribe.views = view;

  /**
  * ### removeAccount
  *
  * `removeAccount` is the view intended to allow user to erase completely its
  * account.
  */

  view.removeAccount = function (c) {
    return [
      m('button.btn.btn-danger', {
        onclick: c.removeAccount
      }, conf.LANG.USER.REMOVE_ACCOUNT),
      m('i', {
        class: 'glyphicon glyphicon-info-sign mp-tooltip mp-tooltip-left',
        'data-msg': conf.LANG.USER.INFO.REMOVE_ACCOUNT
      })
    ];
  };

  /**
  * ### form view
  *
  * Classic view with all fields and changes according to the view.
  */

  view.form = function (c) {
  };


  /**
  * ### main and global view
  *
  * Views with cosmetic and help changes according to the current page.
  */

  view.main = function (c) {
    var elements = [view.form(c)];
    if (c.profileView()) {
      elements.splice(0, 0, m('h2',
        conf.LANG.USER.PROFILE + ' : ' + auth.userInfo().login));
    }
    return m('section', { class: 'user' }, elements);
  };

  subscribe.view = function (c) {
    return layout.view(
      view.main(c),
      c.profileView() ? user.view.aside.profile(c) : user.view.aside.common(c)
    );
  };

  return subscribe;
}).call(this);
