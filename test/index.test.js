const { expect } = require('chai');
const skipModule = require('../index.js');

describe('skip', function() {
  // replace mocha functions with mocks
  let itBefore, describeBefore;
  let itArgs, itSkipArgs, describeArgs, describeSkipArgs;
  before(function() {
    itBefore = global.it;
    describeBefore = global.describe;
    global.it = (...args) => { itArgs = args };
    global.it.skip = (...args) => { itSkipArgs = args };
    global.describe = (...args) => { describeArgs = args };
    global.describe.skip = (...args) => { describeSkipArgs = args };
  })
  after(function() {
    global.it = itBefore;
    global.describe = describeBefore;
  })
  beforeEach(function() {
    itArgs = itSkipArgs = describeArgs = describeSkipArgs = undefined;
  })
  it('should be available as a global object', function() {
    expect(skipModule).to.be.a('function');
    expect(global.skip).to.equal(skipModule);
  })
  it('should create a new instance of Skip where called', function() {
    const newSkip = skip();
    expect(newSkip).to.not.equal(skip);
    expect(newSkip).to.be.instanceOf(skip.constructor);
  })
  it('should have question words as properties', function() {
    for (let qword of [ 'if', 'when', 'while' ]) {
      expect(skip).to.have.property(qword).that.is.a('function');
    }
  })
  describe('it()', function() {
    it('should call skip() of global it', function() {
      skip.it('hello', function() {});
      expect(itSkipArgs[0]).to.equal('hello');
      expect(itSkipArgs[1]).to.be.a('function');
      expect(itArgs).to.be.undefined;
    })
  })
  describe('describe()', function() {
    it('should call skip() of global describe', function() {
      skip.describe('hello', function() {});
      expect(describeSkipArgs[0]).to.equal('hello');
      expect(describeSkipArgs[1]).to.be.a('function');
      expect(describeArgs).to.be.undefined;
    })
  })
  describe('if', function() {
    it('should have unary operator as properties', function() {
      for (let op of [ 'not', 'no' ]) {
        expect(skip.if).to.have.property(op).that.is.a('function');
      }
    })
    it('should clear token list when accessed', function() {
      skip._tokens.push(false);
      skip.if;
      expect(skip._tokens).to.eql([]);
    })
    it('should generate a negative eval when called with a falsy value', function() {
      skip.if('');
      expect(skip._tokens).to.eql([ false ]);
      expect(skip._eval()).to.be.false;
      skip.if('').it('hello', function() {});
      expect(itArgs[0]).to.equal('hello');
    })
    it('should invoke function when called with a function', function() {
      let called = false;
      skip.if(() => { called = true; return true; }).
      it('hello', function() {});
      expect(called).to.be.true;
      expect(itSkipArgs).to.contain('hello');
      expect(itArgs).to.be.undefined;
    })
    it('should return a condition object with binary operators as properties', function() {
      const cond = skip.if(true);
      for (let op of [ 'and', 'or' ]) {
        expect(cond).to.have.property(op).that.is.a('function');
      }
    })
    it('should be chainable', function() {
      skip.if(true).and.if(false);
      expect(skip._tokens).to.eql([true, '&&', false]);
      skip.if(true).and(false);
      expect(skip._tokens).to.eql([true, '&&', false]);
      skip.if(true).or.if.not(false);
      expect(skip._tokens).to.eql([true, '||', '!', false]);
      skip.if(true).or.not(false);
      expect(skip._tokens).to.eql([true, '||', '!', false]);
    })
  })
  describe('unless', function() {
    it('should invert interpreation of condition', function() {
      skip.unless(2 + 2 == 4);
      expect(skip._inverted).to.be.true;
      expect(skip._tokens).to.eql([ true ]);
      expect(skip._eval()).to.be.false;
      skip.unless(2 + 2 == 4).describe('Hello', function() {});
      expect(describeSkipArgs).to.be.undefined;
    })
  })
  describe('forever', function() {
    it('should have question words as properties', function() {
      for (let op of [ 'if', 'when', 'while' ]) {
        expect(skip.forever).to.have.property(op).that.is.a('function');
      }
    })
    it('should set mode to "permanent" when accessed', function() {
      skip.forever;
      expect(skip._mode).to.equal('permanent');
      skip.forever.if;
      expect(skip._mode).to.equal('permanent');
      skip.forever.unless;
      expect(skip._mode).to.equal('permanent');
      expect(skip._inverted).to.equal(true);
    })
    it('should keep skip() from being called when used', function() {
      skip.forever.unless(2 + 2 == 5).it('Hello forever', function() {});
      expect(itArgs).to.be.undefined;
      expect(itSkipArgs).to.be.undefined;
      skip.unless(2 + 2 == 5).it('Hello', function() {});
      expect(itArgs).to.be.undefined;
      expect(itSkipArgs).to.contain('Hello');
    })
    it('should have it() and describe() methods', function() {
      expect(skip.forever).to.have.property('it').that.is.a('function');
      expect(skip.forever).to.have.property('describe').that.is.a('function');
      skip.forever.it('hello', function() {});
      expect(itArgs).to.be.undefined;
      expect(itSkipArgs).to.be.undefined;
    })
  })
  describe('condition()', function() {
    it('should accept an object as argument', function() {
      const skip = global.skip();
      let condition3Checked = false;
      skip.condition({
        condition1: true,
        condition2: false,
        condition3: () => { condition3Checked = true; return true }
      });
      expect(skip.if).to.have.property('condition1').that.is.a('function');
      skip.if.condition1.or.condition2;
      expect(skip._tokens).to.eql([true, '||', false]);
      skip.if.condition1.and.condition3.describe('Hello', function() {});
      expect(condition3Checked).to.be.true;
      expect(describeSkipArgs).to.contain('Hello');
    })
    it('should handle complex expression', function() {
      const skip = global.skip();
      skip.condition({
        browser: {
          is: {
            edge: false,
            chrome: true,
            firefox: false,
          }
        },
        os: {
          is: {
            mac: true,
            windows: false,
            linux: false,
          }
        }
      });
      expect(skip.if).to.have.property('os');
      expect(skip.if.os).to.have.property('is');
      expect(skip.if.os.is).to.have.property('mac');
      skip.if.os.is.mac.and.browser.is.chrome.describe('Hello', function() {});
      expect(describeSkipArgs).to.contain('Hello');
    })
    it('should handle dot notation', function() {
      const skip = global.skip();
      skip.condition('browser', true);
      skip.condition('browser.edge', true);
      skip.condition('browser.chrome', false);
      skip.if.browser;
      expect(skip._eval()).to.be.true;
      skip.if.browser.edge;
      expect(skip._eval()).to.be.true;
      skip.if.browser.chrome;
      expect(skip._eval()).to.be.false;
    })
    it('should allow redefinition', function() {
      const skip = global.skip();
      skip.condition({
        browser: {
          is: {
            edge: false,
            chrome: true,
            firefox: false,
          }
        },
        os: {
          is: {
            mac: true,
            windows: false,
            linux: false,
          }
        }
      });
      expect(skip.if.browser).to.not.have.property('and');
      let browserChecked = false;
      skip.condition('browser', () => { browserChecked = true; return true });
      expect(skip.if.browser).to.have.property('and');
    })
    it('should scan function for definitions as well', function() {
      const skip = global.skip();
      function isBrowser() { return true };
      isBrowser.is = {
        edge: false,
        chrome: true
      };
      skip.condition({
        browser: isBrowser,
      });
      expect(skip.if.browser).to.have.property('and');
      expect(skip.if.browser).to.have.property('is');
      expect(skip.if.browser.is).to.have.property('edge');
    })
    it('should fail if a reserved word is used', function() {
      const skip = global.skip();
      expect(() => skip.condition({ if: {} })).to.throw();
    })
  })
  describe('constructor()', function() {
    it('should call condition() when arguments are given', function() {
      const skip = global.skip({
        browser: {
          is: {
            edge: false,
            chrome: true,
            firefox: false,
          }
        },
        os: {
          is: {
            mac: true,
            windows: false,
            linux: false,
          }
        }
      });
      skip.if.os.is.mac.and.browser.is.chrome.describe('Hello', function() {});
      expect(describeSkipArgs).to.contain('Hello');
    })
  })
  describe('if.[condition]()', function() {
    it('should invoke callback with arguments when called', function() {
      const skip = global.skip({
        browser: (name) => {
          return (name === 'chrome');
        }
      });
      skip.if.browser('edge');
      expect(skip._tokens).to.eql([ false ]);
      skip.if.browser('chrome');
      expect(skip._tokens).to.eql([ true ]);
    })
    it('should throw when callback is not invoked', function() {
      const skip = global.skip({
        browser: (name) => {
          return (name === 'chrome');
        }
      });
      expect(() => skip.if.browser.and).to.throw();
      expect(() => skip.if.browser.it('hello')).to.throw();
    })
    it('should invoke callback with default argument', function() {
      const skip = global.skip({
        browser: (name = 'any') => {
          if (name === 'any') {
            return true;
          } else {
            return (name === 'chrome');
          }
        }
      });
      skip.if.browser;
      expect(skip._tokens).to.eql([ true ]);
      skip.if.browser('edge');
      expect(skip._tokens).to.eql([ true, '&&', false ]);
    })
  })
})
