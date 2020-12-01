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

  _check() {
    // do nothing
  }

  _attach(word) {
    const get = function() {
      // add token to expression
      this._check();
      word._add();
      return word;
    };
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
    const result = this._bool(arg1);
    const condition = this._root._create(undefined, result, [], null);
    condition._add();
    return condition;
  }

  _bool(result, arg1, arg2) {
    if (typeof(result) === 'function') {
      result = result(arg1, arg2);
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
    if (func.length > 2) {
      throw new Error(`Callback cannot use more than 2 arguments`);
    }
    this._func = func;
    this._pending = false;
  }

  _add() {
    if (this._func.length > 0) {
      // wait for _run() to get called
      this._pending = true;
    } else {
      // add boolean value to expression
      const result = this._bool(this._func);
      this._root._add(result);
    }
  }

  _check() {
    if (this._pending) {
      const count = this._func.length;
      const args = `${count} argument${count > 1 ? 's' : ''}`;
      throw new Error(`${this._name}() requires ${args}`)
    }
  }

  _run(arg1, arg2) {
    const result = this._bool(this._func, arg1, arg2);
    const condition = this._root._create(undefined, result);
    condition._add();
    this._pending = false;
    return condition;
  }

  it(desc, func) {
    this._check();
    this._root.it(desc, func);
  }

  describe(desc, func) {
    this._check();
    this._root.describe(desc, func);
  }
}

class Adverb extends Word {
  constructor(root, name, mode) {
    super(root, name);
    this._mode = mode;
  }

  _add() {
    this._root._set(this._mode);
  }

  it(desc, func) {
    this._root.it(desc, func);
  }

  describe(desc, func) {
    this._root.describe(desc, func);
  }
}

class Inverter extends Word {
  _add() {
    this._root._invert();
  }
}

class Skip extends Word {
  constructor(def, func) {
    super(null, 'skip');
    this._mode = undefined;
    this._inverted = false;
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
    this._adverbs = [
      new Adverb(this, 'forever', 'permanent'),
      new Adverb(this, 'entirely', 'permanent'),
      new Adverb(this, 'permanently', 'permanent'),
    ];
    this._inverters = [
      new Inverter(this, 'unless'),
      new Inverter(this, 'until'),
    ];
    // attach adverbs to skip (skip.forever)
    attachManyToOne(this, this._adverbs);
    // attach if to skip (skip.if)
    attachManyToOne(this, this._qwords);
    // attach unless to skip (skip.unless)
    attachManyToOne(this, this._inverters);
    // attach if to forever (skip.forever.if)
    attachManyToMany(this._adverbs, this._qwords);
    // attach unless to forever (skip.forever.unless)
    attachManyToMany(this._adverbs, this._inverters);
    // attach not to if (skip.if.not)
    attachManyToMany(this._qwords, this._unaries);
    // attach not to unless (skip.unless.not)
    attachManyToMany(this._inverters, this._unaries);
    // attach if to and (skip.if.[condition].and.if)
    attachManyToMany(this._binaries, this._qwords);
    // attach not to and (skip.if.[condition].and.not)
    attachManyToMany(this._binaries, this._unaries);
    // these words cannot be used as properties
    const keywords = [ ...this._unaries, ...this._binaries, ...this._qwords];
    this._illegals= keywords.map((k) => k._name);
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

  _set(mode) {
    this._mode = mode;
  }

  _invert() {
    this._inverted = true;
  }

  _check() {
    // reset (just in case there're tokens left over)
    this._reset();
  }

  _reset() {
    this._tokens = [];
    this._mode = undefined;
    this._inverted = false;
  }

  _eval() {
    if (this._tokens.length === 0) {
      return true;
    }
    const expr = this._tokens.join(' ');
    let result = eval(expr);
    if (this._inverted) {
      result = !result;
    }
    return result;
  }

  _create(name, func, path, parent) {
    if (name) {
      if (name.charAt(0) === '_' || this._illegals.includes(name)) {
        throw new Error(`Reserved word cannot be used: ${name}`);
      }
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
        parent._attach(word);
      } else {
        if (name) {
          // attach condition to if (skip.if.[condition])
          attachOneToMany(this._qwords, word);
          // attach condition to unless (skip.unless.[condition])
          attachOneToMany(this._inverters, word);
          // attach condition to not (skip.if.not.[condition])
          attachOneToMany(this._unaries, word);
          // attach condition to and (skip.if.[condition].and.[condition])
          attachOneToMany(this._binaries, word);
        }
      }
      if(word instanceof Condition) {
        // attach and to condition (skip.if.[condition].and)
        attachManyToOne(word, this._binaries);
      }
    }
    return word;
  }

  it(desc, func) {
    // call skip() if expression eval to true
    if (this._eval()) {
      if (this._mode !== 'permanent') {
        it.skip(desc, func);
      }
    } else {
      it(desc, func);
    }
    this._reset();
  }

  describe(desc, func) {
    if (this._eval()) {
      if (this.mode !== 'permanent') {
        describe.skip(desc, func);
      }
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
