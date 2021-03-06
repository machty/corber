const Task             = require('./-task');
const HTMLParser       = require('htmlparser2').Parser;
const Promise          = require('rsvp').Promise;
const path             = require('path');
const fsUtils          = require('../utils/fs-utils');
const cordovaPath      = require('../targets/cordova/utils/get-path');
const logger           = require('../utils/logger');

const ROOT_URL_PATTERN = /^\//;
const NEW_LINE_PATTERN = /\n/g;

module.exports = Task.extend({
  source: undefined,
  project: undefined,

  getPathAttributes(fileContents) {
    return new Promise(function(resolve, reject) {
      let attributes = [];
      let line = 1;

      let parser = new HTMLParser({
        ontext(text) {
          let matches = text.match(NEW_LINE_PATTERN);
          if (matches) { line += matches.length; }
        },
        onopentag(name, attrs) {
          if (attrs.src) {
            attributes.push({
              tagName: name,
              name: 'src',
              value: attrs.src,
              line: line
            });
          }

          if (attrs.href) {
            attributes.push({
              tagName: name,
              name: 'href',
              value: attrs.href,
              line: line
            });
          }
        },
        onend() {
          return resolve(attributes);
        }
      }, {decodeEntities: true});

      parser.end(fileContents);
    });
  },

  validate(attributes) {
    return attributes.filter(function(attribute) {
      return ROOT_URL_PATTERN.test(attribute.value);
    });
  },

  print(path, warnings) {
    if (warnings.length === 0) {
      return logger.success('0 problems');
    }

    let msg = '\n' + path + '\n';
    msg += 'There are remaining paths beginning with / in your code.';
    msg += 'They likely will not work.';

    warnings.forEach(function(w) {
      msg += '  Line ' + w.line + '  ' +
        w.name + '-attribute contains unsupported path relative to root: ' +
        w.value + '\n';
    });

    msg += '\n' + '✖ ' + warnings.length + ' problem(s)';

    logger.warn(msg);
  },

  run() {
    let projectPath = cordovaPath(this.project);
    let indexPath = path.join(projectPath, this.source);

    logger.info('corber : Linting ' + indexPath + '...\n');

    return fsUtils.read(indexPath).then((fileContents) => {
      return this.getPathAttributes(fileContents).then((attributes) => {
        let warnings = this.validate(attributes);

        this.print(indexPath, warnings);

        return Promise.resolve(warnings);
      });
    });
  }
});
