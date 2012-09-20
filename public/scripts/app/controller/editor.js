console.log('Loading file app/controller/editor.js');

define(['require'
    , 'spine/spine'
    , 'app/controller/outline'],

    function(require, Spine, Outline, SaveButton) {

        "use strict";

        console.log('Defining module app/controller/editor.js');

        var Editor = Spine.Controller.sub({

            init: function() {

            },

            initializeEditor: function() {
                this.editor = ace.edit('editor');
                this.session = this.editor.getSession();
                var LatexMode = ace.require("ace/mode/latex").Mode;

                this.session.setMode(new LatexMode());
                this.session.setUseWrapMode(true);
                this.editor.setShowPrintMargin(false);

                this.changed = false;

                this.editor.commands.addCommand({
                    name: 'save',
                    bindKey: {
                        win: 'Ctrl-S',
                        mac: 'Command-S',
                        sender: 'editor'
                    },
                    exec: function(env, args, request) {
                        var datamanager = require('app/module/datamanager');
                        datamanager.save();
                    }
                });

                this.session.on('change', this.proxy(function() {
                    Spine.trigger('change');
                    this.setChanged(true);
                }));

                this.session.on('outline', function(outline) {
                    Outline.update(outline);
                });
            },

            onChange: function(callback) {
                this.session.on('change', function() {
                    callback(this.getValue());
                }.bind(this));
            },

            getValue: function() {
                return this.session.getValue();
            },

            setValue: function(value) {
                this.session.setValue(value);
            },

            setChanged: function(value) {
                this.changed = value;
            },

            hasChanged: function() {
                return this.changed;
            },

            gotoLine: function(lineNumber) {
                this.editor.gotoLine(lineNumber);
            },

            setCursorPosition: function(pos) {
                this.editor.moveCursorToPosition(pos);
            },

            getCursorPosition: function() {
                return this.editor.getCursorPosition();
            }
        });

        return {
            class: Editor,
            instance: new Editor()
        };
    });