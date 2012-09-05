var commandline = require('../modules/commandline');
var Command = commandline.Command;
var path = require('path');
var Promise = require("promised-io/promise").Promise;
var fs = require('fs');
var wrench = require('wrench');
var _ = require('underscore');
var git = require('../modules/git');

var REPOSITORY_DIR = "./public/repositories/";

var Directory = {

    // First in the array is the default
    templatesAvailable: [
        'basic-essay',
        'aalto-university-publication-series',
        'aalto'
    ],

    profiles: {
        dev: {repoDir: "./public/repositories/", templateDir: "./templates/"},
        test: {repoDir: "./public/repositories_test/", templateDir: "./templates/"},
        staging: {repoDir: "./public/repositories/", templateDir: "./templates/"},
        production: {repoDir: "./public/repositories/", templateDir: "./templates/"}
    },

    init: function(profile) {
        _.bindAll(this);

        profile = profile || this.profiles.dev;
        this.profile = profile;

        REPOSITORY_DIR = profile.repoDir;
    },

    loadFixtures: function() {
        var promise = new Promise();

        // Double check
        if(!REPOSITORY_DIR.match('test')) {
            throw "Are you sure repository dir " + REPOSITORY_DIR + " is for testing?";
        }

        wrench.rmdirRecursive(REPOSITORY_DIR, function rmdirRecursivelyClbk(err) {
            wrench.copyDirRecursive('fixtures/files', REPOSITORY_DIR, function copyDirRecursivelyClbk(err) {
                if(err) {
                    promise.reject();
                    return;
                }

                promise.resolve();
            });
        });

        return promise;
    },

    create: function(opts) {
        var id = opts.id;
        var name = opts.name;
        var owner = opts.owner;
        var noGithub = opts.noGithub;
        var template = opts.template;

        var promise = new Promise();

        var repoDir = path.resolve(REPOSITORY_DIR, id);

        var templatePath = this.resolveTemplatePath(template);
        var createDirectory = [new Command('mkdir -p ' + repoDir)];
        var templateCommandsPromise = this.templateCommands(templatePath, repoDir);
        var cloneCommand = [];
        var pushCommand = [];

        if(!noGithub) {
            cloneCommand = [git.clone(owner, name, repoDir)];
            pushCommand = git.initialPush(repoDir);
        }

        templateCommandsPromise.then(function(templateCmd) {
            var commandsToRun = createDirectory.concat(cloneCommand, templateCmd, pushCommand);

            commandline.runAll(commandsToRun).then(function() {
                promise.resolve(repoDir);
            }, function() {
                promise.reject();
            });
        });

        return promise;
    },

    resolveTemplatePath: function(template) {
        template = this.templatesAvailable.indexOf(template) !== -1 ? template : this.templatesAvailable[0];
        template = path.resolve(this.profile.templateDir, template);
        return template;
    },

    templateCommands: function(templatePath, repoDir) {
        var promise = new Promise();

        var commands = [];
        fs.readdir(templatePath, function(err, files) {
            if(err) {
                promise.reject();
            }
            files.forEach(function(file) {
                commands.push(new Command('cp ' + templatePath + '/' + file + ' ' + repoDir));
            });
            promise.resolve(commands);
        });

        return promise;
    },

    compile: function(repoDir) {
        var compilePromise = new Promise();

        var pdflatex1 = new Command('pdflatex --interaction=nonstopmode dippa', repoDir);
        var bibtex1 = new Command('bibtex dippa', repoDir);
        var pdflatex2 = new Command('pdflatex --interaction=nonstopmode dippa', repoDir);
        var bibtex2 = new Command('bibtex dippa', repoDir);
        var pdflatex3 = new Command('pdflatex --interaction=nonstopmode dippa', repoDir);

        commandline.runAll([pdflatex1, bibtex1, pdflatex2, bibtex2, pdflatex3]).then(function(output) {
            compilePromise.resolve(output);
        });

        return compilePromise;
    },

    readFile: function(id, filename) {
        var promise = new Promise();

        fs.readFile(REPOSITORY_DIR + '/' + id + '/' + filename, 'UTF-8', function(err, data) {
            if(err) {
                promise.reject(err);
                return;
            }
            promise.resolve(data);
        });

        return promise;
    },

    deleteFile: function(id, filename) {
        var promise = new Promise();

        fs.unlink(REPOSITORY_DIR + '/' + id + '/' + filename, function(err) {
            if(err) {
                promise.reject(err);
                return;
            }
            promise.resolve();
        });

        return promise;
    },

    readDocumentFile: function(id) {
        return this.readFile(id, 'dippa.tex');
    },

    readReferenceFile: function(id) {
        return this.readFile(id, 'ref.bib');
    }
};

module.exports = Directory;