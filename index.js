class Word extends Function {
  constructor(root, name) {
    if (root) {
      // "this" here will be the parent object
      // call invoke() which will redirect to _run()
      super('arg', `return this._invoke('${name}', arg);`);
    } else {
      // create an instance using constructor stored in global
      super('arg', `return new __skip_constructor(arg);`);
    }
    this._name = name;
    this._root = root;
    this._after = {};
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
    this._after[word._name] = word;
    // attach the getter
    Object.defineProperty(this, word._name, { get });
  }

  _invoke(name, arg) {
    const prop = this._after[name];
    return prop._run(arg);
  }

  _run(arg) {
    const result = !!arg;
    const condition = this._root._create(undefined, result);
    condition._add();
    return condition;
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

  _result(arg) {
    let result = this._func;
    if (typeof(result) === 'function') {
      result = result(arg);
    }
    return !!result;
  }

  _add() {
    // add boolean value to expression
    const result = this._result();
    this._root._add(result.toString());
  }

  _run(arg) {
    const result = this._result(arg);
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
    attachMultipleToOne(this, this._qwords);
    // attach not to if (skip.if.not)
    attachMultipleToMultiple(this._qwords, this._unaries);
    // attach if to and (skip.if.[condition].and.if)
    attachMultipleToMultiple(this._binaries, this._qwords);
    // attach not to and (skip.if.[condition].and.not)
    attachMultipleToMultiple(this._binaries, this._unaries);
    // add conditions if provided
    if (def) {
      this.condition(def, func);
    }
  }

  _add(token) {
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

  _create(name, func, parent) {
    let word;
    if (typeof(func) === 'function' || !(func instanceof Object)) {
      word = new Condition(this, name, func);
    } else {
      // permit something like browser.is.edge
      const def = func;
      word = new Word(this, name);
      for (let [ name, func ] of def) {
        this._create(name, func, word);
      }
    }
    if (parent) {
      this._attach(parent, word);
    } else {
      if (name) {
        // attach condition to if (skip.if.[condition])
        attachOneToMultiple(this._qwords, word);
        // attach condition to not (skip.if.not.[condition])
        attachOneToMultiple(this._unaries, word);
        // attach condition to and (skip.if.[condition].and.[condition])
        attachOneToMultiple(this._binaries, word);
      }
      // attach and to condition (skip.if.[condition].and)
      attachMultipleToOne(word, this._binaries);
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
      def[name] = cond;
    } else {
      def = name;
      if (!(def instanceof Object)) {
        throw new Error(`Invalid argument`);
      }
    }
    for (let [ name, func ] of Object.entries(def)) {
      this._create(name, func);
    }
  }
}

function attachOneToMultiple(words1, word2) {
  for (let word1 of words1) {
    word1._attach(word2);
  }
}

function attachMultipleToOne(word1, words2) {
  for (let word2 of words2) {
    word1._attach(word2);
  }
}

function attachMultipleToMultiple(words1, words2) {
  for (let word2 of words2) {
    attachOneToMultiple(words1, word2);
  }
}

const skip = new Skip;
skip.Skip = Skip;
module.export = skip;
