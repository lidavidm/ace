/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;
var Sk = require("./skulpt").Sk;

var PythonWorker = exports.PythonWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(500);
    this.setOptions();
};

oop.inherits(PythonWorker, Mirror);

(function() {
    this.setOptions = function(options) {
        this.options = options || {
        };
        this.doc.getValue() && this.deferredUpdate.schedule(100);
    };

    this.changeOptions = function(newOptions) {
        oop.mixin(this.options, newOptions);
        this.doc.getValue() && this.deferredUpdate.schedule(100);
    };

    this.onUpdate = function() {
        var value = this.doc.getValue();
        value = value.replace(/^#!.*\n/, "\n");
        if (!value)
            return this.sender.emit("annotate", []);

        var lines = value.split("\n").length - 1;
        var errors = [];
        try {
            // Make sure code is not actually run
            var body = "if False:\n" + value.split("\n").map(function(line) {
                return "    " + line;
            }).join("\n");
            Sk.importMainWithBody("<validate>", false, body, false);
        }
        catch (e) {
            console.log(e);
            if (e.args.v.length === 4) {
                var err = e.args.v[3];
                var location = err[0];
                var row = location[0];
                var column = location[1];
            }
            else if (e.args.v.length === 5) {
                row = e.args.v[2];
                column = e.args.v[3];
            }
            errors.push({
                row: Math.min(row - 1, lines),
                column: column,
                text: e.args.v[0].v,
                type: "error",
                raw: "(no raw error)",
            });
        }

        lines = value.split("\n");
        // Only do the check if this is a method
        if (lines.length > 0 && lines[0].indexOf("This is a method") > -1) {
            for (var i = 3; i < lines.length; i++) {
                var line = lines[i];
                // Make sure lines are indented
                if (line.trim() && line[0] != " ") {
                    errors.push({
                        row: i,
                        column: 0,
                        text: "Indent this line!",
                        type: "error",
                        raw: "(no raw error)",
                    });
                }
            }
        }

        this.sender.emit("annotate", errors);
    };

}).call(PythonWorker.prototype);

});
