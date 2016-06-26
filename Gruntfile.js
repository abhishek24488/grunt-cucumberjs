/*
 * grunt-cucumberjs
 * https://github.com/mavdi/cucumberjs
 *
 * Copyright (c) 2013 Mehdi Avdi
 * Licensed under the MIT license.
 */

'use strict';
var assertReport = require('./test/assert/assertReport');

module.exports = function(grunt) {
    var options = {
        templateDir: 'templates/bootstrap',
        output: 'test/report/features_report.html',
        theme: 'bootstrap',
        debug: true,
        reportSuiteAsScenarios: true
    };

    function verifyReport() {
        assertReport.assert(options.output);
    }

    function setParallelMode() {
        options.executeParallel = true;
        options.parallel = 'scenarios';
        return options;
    }

    function setSingleFormatter() {
        options.format = 'html';
        return options;
    }

    function setMultiFormatter() {
        options.formats = ['html', 'pretty'];
        return options;
    }

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: [
                'Gruntfile.js',
                'package.json',
                'tasks/*.js',
                'features/**/*.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        // Before generating any new files, remove any previously-created files.
        clean: {
            tests: ['test/report/*.json', 'test/report/*.html', 'test/report/screenshot/*.png']
        },

        // Configuration to be run (and then tested).
        cucumberjs: {
            options: options,
            src: ['test/features']
        },

        jsbeautifier: {
            src: ['<%= jshint.all %>']
        }
    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-jsbeautifier');

    grunt.registerTask('assertReport', verifyReport);
    grunt.registerTask('setSingleFormatter', setSingleFormatter);
    grunt.registerTask('setMultiFormatter', setMultiFormatter);
    grunt.registerTask('setParallelMode', setParallelMode);

    grunt.registerTask('testSingleFormatter', ['clean', 'setSingleFormatter', 'cucumberjs', 'assertReport']);
    grunt.registerTask('testMultiFormatter', ['clean', 'setMultiFormatter', 'cucumberjs', 'assertReport']);
    grunt.registerTask('testParallelMode', ['clean', 'setParallelMode', 'cucumberjs', 'assertReport']);


    // By default, lint and run all tests.
    grunt.registerTask('default', ['jshint', 'jsbeautifier', 'testSingleFormatter', 'testMultiFormatter', 'testParallelMode']);
};
