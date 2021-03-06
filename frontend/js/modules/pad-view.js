/**
*  # Group View module
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
*  This module lists all pads linked to the group.
*/

module.exports = (function () {
  'use strict';
  // Global dependencies
  var m = require('mithril');
  var ld = require('lodash');
  var encode = require('js-base64').Base64.encode;
  // Local dependencies
  var conf = require('../configuration.js');
  var auth = require('../auth.js');
  var layout = require('./layout.js');
  var model = require('../model/group.js');
  var padMark = require('./pad-mark.js');
  var padShare = require('./pad-share.js');

  var pad = {};

  /**
  * ## Controller
  */

  pad.controller = function () {

    var c = {
      group: {},
      pad: {},
      sendPass: m.prop(false),
      password: m.prop(''),
      showIframe: m.prop(true)
    };

    c.isAuth = auth.isAuthenticated();
    c.isGuest = !c.isAuth;
    c.bookmarks = (c.isAuth ? auth.userInfo().bookmarks.pads : []);

    c.gid = m.route.param('group');
    c.pid = m.route.param('pad');

    /**
    * ## init function
    *
    * Gathers group and pad values from local cache.
    * Admin should not need password when visibility is private.
    */

    var init = function (err) {
      if (err) { return m.route('/mypads'); }
      var _init = function () {
        var data = c.isGuest ? model.tmp() : model;
        c.group = data.groups()[c.gid] || {};
        c.pad = data.pads()[c.pid];
        if (!c.pad) { return m.route('/mypads'); }
        document.title = conf.LANG.GROUP.PAD.PAD + ' ' + c.pad.name;
        document.title += ' - ' + conf.SERVER.title;
        c.isAdmin = (function () {
          if (c.isAuth && c.group.admins) {
            return ld.includes(c.group.admins, auth.userInfo()._id);
          } else {
            return false;
          }
        })();
      };
      if (model.pads()[c.pid]) {
        _init();
      } else {
        c.isGuest = true;
        model.fetchObject({ group: c.gid, pad: c.pid }, undefined, _init);
      }
    };

    var fetchFn = (function () {
      if (c.isAuth) {
        return ld.partial(model.fetch, init);
      } else {
        var keys = { group: c.gid, pad: c.pid };
        return ld.partial(model.fetchObject, keys, undefined, init);
      }
    })();
    if (ld.isEmpty(model.pads())) { fetchFn(); } else { init(); }

    c.submit = function (e) {
      e.preventDefault();
      model.fetchObject({ group: c.gid, pad: c.pid }, c.password(),
        function (err) {
          if (err) { return c.sendPass(false); }
          var data = c.isGuest ? model.tmp() : model;
          c.group = data.groups()[c.gid];
          c.pad = data.pads()[c.pid];
          c.sendPass(true);
        }
      );
    };

    return c;
  };

  /**
  * ## Views
  */

  var view = {};

  view.passForm = function(c) {
    return m('form', {
      id: 'password-form',
      onsubmit: c.submit
    }, [
      m('label.block', { for: 'mypadspassword' }, conf.LANG.USER.PASSWORD),
      m('input.block', {
        type: 'password',
        required: true,
        placeholder: conf.LANG.USER.UNDEF,
        value: c.password(),
        oninput: m.withAttr('value', c.password)
      }),
      m('input.ok.block', {
        form: 'password-form',
        type: 'submit',
        value: conf.LANG.USER.OK
      })
    ]);
  };

  view.pad = function (c) {
    var p = (c.sendPass() ? '&mypadspassword=' + encode(c.password()) : '');
    var a = (auth.isAuthenticated() ? '&auth_token=' + auth.token() : '');
    var link = '/p/' + c.pad._id + '?' + p + a;
    return [
      m('p.text-right', [
        m('a.btn.btn-default.new-window', {
          href: link,
          target: '_blank',
          title: conf.LANG.GROUP.PAD.OPEN_TAB,
          onclick: function () {
            c.showIframe(false);
            return true;
          }
        }, [
          m('i.glyphicon.glyphicon-new-window')
        ])
        ]),
      (function () {
        if (c.showIframe()) {
          return m('iframe', { src: link });
        }
      })()
    ];
  };

  view.main = function (c) {
    var isPrivate = (function () {
      if (c.pad) {
        return (c.pad.visibility === 'private');
      } else {
        return (c.group.visibility && c.group.visibility === 'private');
      }
    })();
    var showPass = (isPrivate && !c.sendPass());
    if (showPass) { return view.passForm(c); }
    var route = '/mypads/group/' + c.gid;
    var GROUP = conf.LANG.GROUP;
    return m('section', { class: 'group' }, [
      m('.btn-group.pull-right', [
        (function () {
          var isGroupSharable = (c.group && c.group.visibility &&
            c.group.visibility !== 'restricted');
          var isPadSharable = (c.pad.visibility &&
            c.pad.visibility !== 'restricted');
          if (isGroupSharable || isPadSharable) {
              return m('button.btn.btn-default', {
                title: conf.LANG.GROUP.SHARE,
                onclick: padShare.bind(c, c.gid, c.pad._id)
              },
              [ m('i.glyphicon glyphicon-link'),
                m('span', ' '+conf.LANG.GROUP.SHARE)
              ]);
          }
        })(),
        (function () {
          if (c.isAdmin) {
            return m('a.btn.btn-default', {
              href: route + '/pad/edit/' + c.pad._id,
              config: m.route,
              title: conf.LANG.MENU.CONFIG
            },
            [ m('i.glyphicon glyphicon-wrench'),
              m('span', ' '+conf.LANG.MENU.CONFIG)
            ]);
            }
        })(),
        (function () {
          if (c.isAdmin) {
            return m('a.btn.btn-danger', {
              href: route + '/pad/remove/' + c.pad._id,
              config: m.route,
              title: conf.LANG.GROUP.REMOVE
            },
            [ m('i.glyphicon glyphicon-trash'),
              m('span', ' '+conf.LANG.GROUP.REMOVE)
            ]);
          }
        })()
      ]),
      m('h2', [
        (function () {
          if (!c.isGuest) {
            var isBookmarked = ld.includes(c.bookmarks, c.pad._id);
            return m('button.btn.btn-link.btn-lg', {
              title: (isBookmarked ? GROUP.UNMARK : GROUP.BOOKMARK),
              onclick: function () { padMark(c.pad._id); }
            }, [
              m('i',
                { class: 'glyphicon glyphicon-star' +
                  (isBookmarked ? '' : '-empty'),
                  title: (isBookmarked ? GROUP.UNMARK : GROUP.BOOKMARK) })
            ]);
          }
        })(),
        m('span', conf.LANG.GROUP.PAD.PAD + ' ' + c.pad.name),
        (function () {
          if (c.group && c.group.name) {
            return [ m('br'), m('span.h3', [
              ' (',
              conf.LANG.GROUP.PAD.FROM_GROUP+' ',
              m('a', {
                href: route + '/view',
                config: m.route,
                title: conf.LANG.GROUP.VIEW
              }, c.group.name ),
              ')'
            ])];
          }
        })()
      ]),
      m('section.pad', view.pad(c))
    ]);
  };

  pad.view = function (c) {
    return layout.view(view.main(c));
  };

  return pad;

}).call(this);
