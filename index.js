class Word extends Function {
  constructor(root, name) {
    if (root) {
      // "this" here will be the parent object
      // call _invoke() which will redirect to _run()
      super('arg1', 'arg2', `return this._invoke('${name}', arg1, arg2);`);
    } else {
      // create an instance using constructor stored in global
      super('arg1', 'arg2', `return new global.skip.constructor(arg1, arg2);`);
    }
    this._name = name;
    this._root = root;
    this._props = {};
  }

  _add() {
    // do nothing
  }

  _attach(word) {
    let get;
    if (!this._root) {
      // skip object
      get = function() {
        // reset (just in case)
        this._reset();
        return word;
      };
    } else {
      get = function() {
        // add token to expression
        word._add();
        return word;
      };
    }
    // so we can access the word object without trigger the getter function
    this._props[word._name] = word;
    // attach the getter
    Object.defineProperty(this, word._name, { get, configurable: true });
  }

  _invoke(name, arg1, arg2) {
    const prop = this._props[name];
    return prop._run(arg1, arg2);
  }

  _run(arg1, arg2) {
    const result = !!arg1;
    const condition = this._root._create(undefined, result, [], null);
    condition._add();
    return condition;
  }

  _bool(result, arg1, arg) {
    if (typeof(result) === 'function') {
      result = result(arg1, arg);
    }
    return !!result;
  }
}

class Operator extends Word {
  constructor(root, name, symbol) {
    super(root, name);
    this._symbol = symbol;
  }

  _add() {
    // add symbol to expression
    this._root._add(this._symbol);
  }
}

class Condition extends Word {
  constructor(root, name, func) {
    super(root, name);
    this._func = func;
  }

  _add() {
    // add boolean value to expression
    const result = this._bool(this._func);
    this._root._add(result);
  }

  _run(arg1, arg2) {
    const result = this._bool(this._func, arg1, arg2);
    const condition = this._root._create(undefined, result);
    condition._add();
    return condition;
  }

  it(desc, func) {
    this._root.it(desc, func);
  }

  describe(desc, func) {
    this._root.describe(desc, func);
  }
}

class Skip extends Word {
  constructor(def, func) {
    super(null, 'skip');
    this._tokens = [];
    this._unaries = [
      new Operator(this, 'not', '!'),
      new Operator(this, 'no', '!'),
    ];
    this._binaries = [
      new Operator(this, 'and', '&&'),
      new Operator(this, 'or', '||'),
    ];
    this._qwords = [
      new Word(this, 'if'),
      new Word(this, 'when'),
      new Word(this, 'while'),
    ];
    // attach if to skip (skip.if)
    attachManyToOne(this, this._qwords);
    // attach not to if (skip.if.not)
    attachManyToMany(this._qwords, this._unaries);
    // attach if to and (skip.if.[condition].and.if)
    attachManyToMany(this._binaries, this._qwords);
    // attach not to and (skip.if.[condition].and.not)
    attachManyToMany(this._binaries, this._unaries);
    // these words cannot be used as properties
    const keywords = [ ...this._unaries, ...this._binaries, ...this._qwords];
    this._illegals= keywords.map((k) => k.name);
    // add conditions if provided
    if (def) {
      this.condition(def, func);
    }
  }

  _add(token) {
    if (typeof(token) === 'boolean') {
      const last = this._tokens[this._tokens.length - 1];
      if (typeof(last) === 'boolean') {
        this._tokens.push('&&');
      }
    }
    this._tokens.push(token);
  }

  _reset() {
    if (this._tokens.length !== 0) {
      this._tokens = [];
    }
  }

  _eval() {
    if (this._tokens.length === 0) {
      return true;
    }
    const expr = this._tokens.join(' ');
    return eval(expr);
  }

  _create(name, func, path, parent) {
    if (name.charAt(0) === '_' || this._illegals.includes(name)) {
      throw new Error(`Reserved word cannot be used: ${name}`);
    }
    const prev = (parent && name) ? parent._props[name] : null;
    let word;
    if (typeof(func) === 'function' || !(func instanceof Object)) {
      word = new Condition(this, name, func);
      if (prev) {
        // copy props
        for (let wordAfter of Object.values(prev._props)) {
          word._attach(wordAfter);
        }
      }
    }
    // permit something like browser.is.edge
    if (func instanceof Object) {
      if (!word) {
        word = prev || new Word(this, name);
      }
      const def = func;
      for (let [ name, func ] of Object.entries(def)) {
        this._create(name, func, [ ...path, name ], word);
      }
    }
    if (word !== prev) {
      if (parent) {
        this._attach(parent, word);
      } else {
        if (name) {
          // attach condition to if (skip.if.[condition])
          attachOneToMany(this._qwords, word);
          // attach condition to not (skip.if.not.[condition])
          attachOneToMany(this._unaries, word);
          // attach condition to and (skip.if.[condition].and.[condition])
          attachOneToMany(this._binaries, word);
        }
        // attach and to condition (skip.if.[condition].and)
        attachManyToOne(word, this._binaries);
      }
    }
    return word;
  }

  it(desc, func) {
    // call skip() if expression eval to true
    if (this._eval()) {
      it.skip(desc, func);
    } else {
      it(desc, func);
    }
    this._reset();
  }

  describe(desc, func) {
    if (this._eval()) {
      describe.skip(desc, func);
    } else {
      describe(desc, func);
    }
    this._reset();
  }

  condition(name, cond) {
    let def;
    if (cond !== undefined) {
      def = {};
      const pnames = name.split('.');
      const cname = pnames.pop();
      let parent = def;
      for (let pname of pnames) {
        const gparent = parent;
        gparent[pname] = parent = {};
      }
      parent[cname] = cond;
    } else {
      def = name;
      if (!(def instanceof Object)) {
        throw new Error(`Invalid argument`);
      }
    }
    for (let [ name, func ] of Object.entries(def)) {
      this._create(name, func, [], null);
    }
  }
}

function attachOneToMany(words, wordAfter) {
  for (let word of words) {
    word._attach(wordAfter);
  }
}

function attachManyToOne(word, wordsAfter) {
  for (let wordAfter of wordsAfter) {
    word._attach(wordAfter);
  }
}

function attachManyToMany(words, wordsAfter) {
  for (let wordAfter of wordsAfter) {
    attachOneToMany(words, wordAfter);
  }
}

global.skip = module.exports = new Skip;
