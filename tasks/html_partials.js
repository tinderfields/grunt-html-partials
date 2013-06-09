/*
 * grunt-html-partials
 * https://github.com/tinderfields/grunt-html-partials
 *
 * Copyright (c) 2013 Paul Odeon
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  //#region Global Properties

  var // Init 
      _ = grunt.util._,
      EOL = grunt.util.linefeed,
      path = require('path'),

      // Tags Regular Expressions
      regexTagStart = "<!--\\s*%parseTag%:(partial)\\s*([^\\s]*)\\s*-->", // <!-- build:{partial} {name} --> {}
      regexTagEnd = "<!--\\s*\\/%parseTag%\\s*-->",
      isFileRegex = /\.(\w+){2,4}$/;  // <!-- /build -->

  //#endregion

  //#region Private Methods

  function getBuildTags(content) {
      var lines = content.replace(/\r\n/g, '\n').split(/\n/),
          tag = false,
          tags = [],
          last;

      lines.forEach(function (l) {
          var tagStart = l.match(new RegExp(regexTagStart)),
              tagEnd = new RegExp(regexTagEnd).test(l);

          if (tagStart) {
              tag = true;
              last = { type: tagStart[1], name: tagStart[2], lines: [] };
              tags.push(last);
          }

          // switch back tag flag when endbuild
          if (tag && tagEnd) {
              last.lines.push(l);
              tag = false;
          }

          if (tag && last) {
              last.lines.push(l);
          }
      });

      return tags;
  }
  function validateBlockWithName(tag, params) {
      var src = params['partial_path'] + '/_' + tag.name + '.html';

      if (src) {
          var opt = {},
              files = src;

          if (_.isObject(src)) {
              opt = src;
              files = src.files;

              delete opt.files;
          }
          
          return grunt.file.expand(opt, files);
      }
  }

  function validateBlockAlways(tag) {
    return true;
  }

  function setTagRegexes(parseTag) {
      regexTagStart = regexTagStart.replace(/%parseTag%/, function () { return parseTag });
      regexTagEnd = regexTagEnd.replace(/%parseTag%/, function () { return parseTag });
  }

  //#endregion

  //#region Processors / Validators / Templates

  var
      validators = {
          partial: validateBlockWithName,

          //base method
          validate: function (tag, params) {
              return validators[tag.type](tag, params);
          }
      },
      processors = {
          partial: function (options) {
              return options.files.map(grunt.file.read).join(EOL);
          },

          //base method
          transform: function (options) {
              return processors[options.type](options);
          }
      };

  //#endregion

  grunt.registerMultiTask('html_partials', "Simple partials for grunt", function () {
      var config = grunt.config(),
          params = this.options({
              logOptionals: false,
              sections: {},
              data: {},
              parseTag: 'build'
          });

      setTagRegexes(params.parseTag);

      this.files.forEach(function (file) {

          var dest = file.dest || "",
              destPath, content, tags;

          file.src.forEach(function (src) {
              if (params.replace) {
                  destPath = src;
              }
              else if (isFileRegex.test(dest)) {
                  destPath = dest;
              }
              else {
                  destPath = path.join(dest, path.basename(src));
              }

              content = grunt.util.normalizelf(grunt.file.read(src).toString());
              tags = getBuildTags(content);

              tags.forEach(function (tag) {
                  var raw = tag.lines.join(EOL),
                      result = "",
                      tagFiles = validators.validate(tag, params);

                  if (tagFiles) {
                      var options = _.extend({}, tag, {
                          data: _.extend({}, config, params.data),
                          files: tagFiles,
                          dest: dest,
                          prefix: params.prefix
                      });

                      result = processors.transform(options);
                  }
                  else if (tag.optional) {
                      if (params.logOptionals)
                          grunt.log.error().error("Tag with type: '" + tag.type + "' and name: '" + tag.name + "' is not configured in your Gruntfile.js but is set optional, deleting block !");
                  }
                  else {
                      grunt.fail.warn("Tag with type '" + tag.type + "' and name: '" + tag.name + "' is not configured in your Gruntfile.js !");
                  }

                  content = content.replace(raw, function () { return result });
              });

              // write the contents to destination
              grunt.file.write(destPath, content);
              grunt.log.ok("File " + destPath + " created !");
          });
      });
  });

};
