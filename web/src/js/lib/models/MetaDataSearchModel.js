/**
 * This model is used to store the state of a search query, and implements the
 * search filtering logic.
 */
cinema.models.MetaDataSearchModel = Backbone.Model.extend({
    constructor: function (settings) {
        Backbone.Model.apply(this, arguments);

        this.visModel = settings.visModel;
        this.query = settings.query || {};
        this.exclude = ["filename"];

        this.results = [];

        this.listenTo(this.visModel, 'change', this.readyToInitialize);
        this.readyToInitialize();
    },

    /**
     * Use the info.json "name_pattern" and "arguments" keys to build an
     * internal ordered list used in mapping ordinals to relative directory
     * paths.
     */
    readyToInitialize: function () {
        if (!this.visModel.loaded()) {
            return;
        }
        var pattern = this.visModel.get('name_pattern') || "",
            args = this.visModel.get('arguments') || {},
            compList = pattern.replace('_','/').replace('.jpg','').replace('.png','').split('/'),
            i,
            re = /{(.+)}/,
            self = this;

        this.filename = null;
        if (pattern.indexOf("{filename}") >= 0) {
            this.filename = args.filename.default;
        }

        this._argArrays = [];
        this._argKeys = [];
        this._maxOrdinal = 1;
        this._multipliers = [];

        _.each(compList.slice(0, compList.length), function (value, idx, list) {
            var match = re.exec(value);
            if (!(_.contains(self.exclude, match[1]))) {
                var arr = args[match[1]].values;
                self._argKeys.push(match[1]);
                self._argArrays.push(arr);
                self._maxOrdinal *= arr.length;
            }
        });
        this._maxOrdinal -= 1;

        this._realKeys = [];
        for (i = 0; i < this._argKeys.length; i += 1) {
            this._realKeys.push(this._argKeys[i]);
        }

        var multiplier = 1;
        for (i = this._argArrays.length - 1; i >= 0; i-=1) {
            this._multipliers.unshift(multiplier);
            multiplier *= this._argArrays[i].length;
        }

        this._dataMap = this.buildDataMap();
    },

    buildDataMap: function() {
        var i,
            j,
            obj,
            results = [],
            url;

        for (i = 0; i <= this._maxOrdinal; i += 1) {
            obj = this.ordinalToObject(i);
            url = this.basePath + '/' + this.objectToPath(obj);
            results.push( {"index": i, "obj": obj, "url": url, "keep": false} );
        }
        return results;
    },

    /**
     * Use an expression parse tree to validate query and block against code injection.
     */

    validateQuery: function (query) {
        try {
            var parse_tree = jsep(query);
            return query;
        }
        catch (e) {
            return null;
        }
    },

    filterBy: function (queryExpression) {
        this.clearResults();
        var functionTemplate = 'var LOCAL_VARS; return (EXP);',
            variableTemplate = 'ARG = obj["ARG"]',
            count,
            localVariables = [],
            numberOfValidResults = 0;

        // Generate filter function
        for(var i = 0; i < this._realKeys.length; i += 1) {
            localVariables.push(variableTemplate.replace(/ARG/g, this._realKeys[i]));
        }
        functionTemplate = functionTemplate.replace(/LOCAL_VARS/g, localVariables.join(',')).replace(/EXP/g, queryExpression);
        /*jshint -W054 */
        var validator = new Function('obj', functionTemplate);

        // Filter by the query
        for (count = 0; count <= this._maxOrdinal; count += 1) {
            this._dataMap[count].keep = validator(this._dataMap[count].obj);
            if(this._dataMap[count].keep) {
                numberOfValidResults += 1;
            }
        }

        return numberOfValidResults;
    },

    allResults: function () {
        for (var count = 0; count <= this._maxOrdinal; count += 1) {
            this._dataMap[count].keep = true;
        }
        return this._maxOrdinal;
    },

    clearResults: function (queryExpression) {
        for (var count = 0; count <= this._maxOrdinal; count += 1) {
            this._dataMap[count].keep = false;
        }
    },

    sortBy: function (sortExpression) {
        var functionTemplate = 'function extractValue(obj) { var LOCAL_VARS; return (EXP);}; return extractValue(a) - extractValue(b);',
            variableTemplate = 'ARG = obj.obj["ARG"]',
            localVariables = [];

        for(var i = 0; i < this._realKeys.length; i += 1) {
            localVariables.push(variableTemplate.replace(/ARG/g, this._realKeys[i]));
        }

        functionTemplate = functionTemplate.replace(/LOCAL_VARS/g, localVariables.join(',')).replace(/EXP/g, sortExpression);
        /*jshint -W054 */
        var sortFunction = new Function(["a","b"], functionTemplate);
        this._dataMap.sort(sortFunction);
    },

    /**
     * This method sets the search results.
     */
    setResultsList: function () {
        this.results = [];
        var i;

        for (i = 0; i <= this._maxOrdinal; i += 1) {
            if (this._dataMap[i].keep) {
                var viewpoint = this.ordinalToObject(this._dataMap[i].index);
                this.results.push(viewpoint);
            }
        }
    },

    /**
     * Convenience function to return the quotient and remainder from
     * integer division of the arguments
     */
    integerDivide: function (dividend, divisor) {
        return {
            'quo': Math.floor(dividend / divisor),
            'rem': dividend % divisor
        };
    },

    /**
     * Given an object with a value for each of the arguments in the vis
     * model, e.g.
     *
     *     {
     *         "time": "0",
     *         "theta": "10.0",
     *         "phi": "170.0"
     *     }
     *
     * return the image ordinal for the corresponding image.
     */
    objectToOrdinal: function(obj) {
        var ordinal = 0;

        for (var argIdx = 0; argIdx < this._argKeys.length; argIdx+=1) {
            var idxInArray = _.indexOf(this._argArrays[argIdx], obj[this._argKeys[argIdx]]);
            ordinal += (idxInArray * this._multipliers[argIdx]);
        }

        return ordinal;
    },

    /**
     * Convert an image ordinal to an object containing the correct
     * values for each component in the info.json 'name_pattern', e.g.
     *
     *     {
     *         "time": "0",
     *         "theta": "10.0",
     *         "phi": "170.0"
     *     }
     *
     */
    ordinalToObject: function (ordinal) {
        if (ordinal > this._maxOrdinal) {
            throw "Ordinal " + ordinal + " out of range, max ordinal: " + this._maxOrdinal;
        }

        // Now proceed to integer divide the ordinal by rightmost length, save
        // remainder, then integer divide that quotient by the next
        // length to the left, save the remainder, etc... until you
        // get to the far left.
        var quotient = ordinal;
        var results = {};

        for (var i = this._argArrays.length - 1; i >= 0; i -= 1) {
            var r = this.integerDivide(quotient, this._argArrays[i].length);
            results[this._argKeys[i]] = this._argArrays[i][r.rem];
            quotient = r.quo;
        }

        return results;
    },

    /**
     * Take an object of the form:
     *
     *    {
     *        "time": "0",
     *        "theta": "10.0",
     *        "phi": "170.0"
     *    }
     *
     * And use the internal order list _argKeys to create a relative path string
     * from it.
     *
     */
    objectToPath: function (obj) {
        if (this.filename !== null) {
            obj.filename = this.filename;
        }
        return this.visModel.getFilePattern(obj);
    }
});
