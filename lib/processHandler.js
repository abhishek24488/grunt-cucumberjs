'use strict';

var fs = require('fs');
var jsonFile = require('jsonfile');
var spawn = require('child_process').spawn;
var _ = require('underscore');
var commondir = require('commondir');

module.exports = function HandleUsingProcess(grunt, options, commands, callback) {
    var version = grunt.file.readJSON('./package.json').version;
    var projectPkg = grunt.file.readJSON('package.json');

    function getBinPath(winBinPath, unixBinPath) {
        return process.platform === 'win32' ? winBinPath : unixBinPath;
    }

    var WIN32_BIN_PATH,
        UNIX_BIN_PATH;

    if (options.executeParallel) {
        UNIX_BIN_PATH = 'node_modules/grunt-cucumberjs/node_modules/cucumber-parallel/bin/cucumber-parallel';
        WIN32_BIN_PATH = 'node_modules\\grunt-cucumberjs\\node_modules\\cucumber-parallel\\bin\\cucumber-parallel';
        if (!grunt.file.exists(getBinPath(WIN32_BIN_PATH, UNIX_BIN_PATH))) {
            UNIX_BIN_PATH = 'node_modules/cucumber-parallel/bin/cucumber-parallel';
            WIN32_BIN_PATH = 'node_modules\\cucumber-parallel\\bin\\cucumber-parallel';
        }
    } else {
        WIN32_BIN_PATH = 'node_modules\\.bin\\cucumber-js.cmd';
        UNIX_BIN_PATH = 'node_modules/cucumber/bin/cucumber.js';
    }

    var buffer = [];
    var cucumber;
    var binPath = getBinPath(WIN32_BIN_PATH, UNIX_BIN_PATH);

    if (!grunt.file.exists(binPath)) {
        if (options.executeParallel) {
            grunt.log.error('cucumber parallel binary not found at path ' + binPath + '\n NOTE: You cannot install grunt-cucumberjs without bin links on windows');
        } else {
            grunt.log.error('cucumberjs binary not found at path ' + binPath + '\n NOTE: You cannot install grunt-cucumberjs without bin links on windows');
        }
        return callback(false);
    }

    cucumber = spawn(binPath, commands);

    cucumber.stdout.on('data', function(data) {
        if (options.isHtml) {
            if (options.debug) {
                process.stdout.write(data);
            }
            buffer.push(data);
        } else {
            grunt.log.write(data);
        }
    });

    cucumber.stderr.on('data', function(data) {
        if (options.debug) {
            process.stdout.write(data);
        }
        var stderr = new Buffer(data);
        grunt.log.error(stderr.toString());
    });

    cucumber.on('close', function(code) {

        if (options.isHtml) {

            var featureJsonOutput;
            var jsonOutput;
            var jsonFilePath = options.output + '.json';

            if (options.executeParallel) {
                jsonOutput = JSON.stringify(jsonFile.readFileSync(jsonFilePath));
            } else {
                var jsonOutputFilePath = jsonFilePath;

                if (fs.existsSync(jsonFilePath)) {
                    jsonOutput = JSON.stringify(jsonFile.readFileSync(jsonOutputFilePath));
                } else {
                    grunt.log.error('Unable to find cucumberjs json output file \'%s\'', jsonOutputFilePath);
                }
            }

            try {
                featureJsonOutput = JSON.parse(jsonOutput);
            } catch (e) {
                grunt.log.error('Unable to parse cucumberjs output into json.');

                return callback(false);
            }

            generateReport(featureJsonOutput);
        }

        return callback(code);
    });

    /**
     * Adds passed/failed properties on features/scenarios
     *
     * @param {object} suite The test suite object
     */
    var setStats = function(suite) {
        var featureOutput = suite.features;
        var featuresSummary = suite.features.summary;
        var rootDir = commondir(_.pluck(featureOutput, 'uri'));
        var screenShotDirectory;
        if (options.output.lastIndexOf('/') > -1) {
            screenShotDirectory = options.output.substring(0, options.output.lastIndexOf('/')) + '/screenshot/';
        } else {
            screenShotDirectory = 'screenshot/';
        }
        featureOutput.forEach(function(feature) {
            feature.relativeFolder = feature.uri.slice(rootDir.length);
            feature.scenarios = {};
            feature.scenarios.passed = 0;
            feature.scenarios.failed = 0;
            feature.scenarios.notdefined = 0;
            feature.scenarios.skipped = 0;
            featuresSummary.isFailed = false;

            if (!feature.elements) {
                return;
            }

            feature.elements.forEach(function(element) {
                element.passed = 0;
                element.failed = 0;
                element.notdefined = 0;
                element.skipped = 0;

                element.steps.forEach(function(step) {
                    if (step.embeddings !== undefined) {
                        var Base64 = require('js-base64').Base64;
                        step.embeddings.forEach(function(embedding) {
                            if (embedding.mime_type === "text/plain") {
                                if (!step.text) {
                                    step.text = Base64.decode(embedding.data);
                                } else {
                                    step.text = step.text.concat('<br>' + Base64.decode(embedding.data));
                                }
                            } else {
                                var name = step.name && step.name.split(' ').join('_') || step.keyword.trim();
                                if (!fs.existsSync(screenShotDirectory)) {
                                    fs.mkdirSync(screenShotDirectory);
                                }
                                name = name + Math.round(Math.random() * 10000) + '.png'; //randomize the file name
                                var filename = screenShotDirectory + name;
                                fs.writeFile(filename, new Buffer(embedding.data, 'base64'), function(err) {
                                    if (err) {
                                        console.error('Error saving screenshot ' + filename); //asynchronously save screenshot
                                    }
                                });
                                step.image = 'screenshot/' + name;
                            }
                        });
                    }

                    if (!step.result) {
                        return 0;
                    }
                    if (step.result.status === 'passed') {
                        return element.passed++;
                    }
                    if (step.result.status === 'failed') {
                        return element.failed++;
                    }
                    if (step.result.status === 'undefined') {
                        return element.notdefined++;
                    }

                    element.skipped++;
                });

                if (element.notdefined > 0) {
                    feature.scenarios.notdefined++;
                    return suite.scenarios.notdefined++;
                }

                if (element.failed > 0) {
                    feature.scenarios.failed++;
                    featuresSummary.isFailed = true;
                    return suite.scenarios.failed++;
                }

                if (element.skipped > 0) {
                    feature.scenarios.skipped++;
                    return suite.scenarios.skipped++;
                }

                if (element.passed > 0) {
                    feature.scenarios.passed++;
                    return suite.scenarios.passed++;
                }
            });

            if (featuresSummary.isFailed) {
                featuresSummary.failed++;
                suite.failed++;
            } else {
                featuresSummary.passed++;
                suite.passed++;
            }

            if (options.reportSuiteAsScenarios) {
                suite.failed = suite.scenarios.failed;
                suite.passed = suite.scenarios.passed;
            }

            return suite;

        });

        suite.features = featureOutput;

        return suite;
    };

    /**
     * Returns the path of a template
     *
     * @param {string} name The template name
     */
    var getPath = function(name) {
        var path = 'node_modules/grunt-cucumberjs/templates/' + options.theme + '/' + name;
        // return the users custom template if it has been defined
        if (grunt.file.exists(options.templateDir + '/' + name)) {
            path = options.templateDir + '/' + name;
        }

        return path;
    };

    /**
     * Generate html report
     *
     * @param {object} featureOutput Features result object
     * @param {string} logOutput Contains any console statements captured during the test run
     */
    var generateReport = function(featureOutput) {
        featureOutput.summary = {
            isFailed: false,
            passed: 0,
            failed: 0
        };

        var suite = {
            name: projectPkg.name,
            version: projectPkg.version,
            time: new Date(),
            features: featureOutput,
            passed: 0,
            failed: 0,
            scenarios: {
                passed: 0,
                failed: 0,
                skipped: 0,
                notdefined: 0
            }
        };

        suite = setStats(suite);

        grunt.file.write(
            options.output,
            _.template(grunt.file.read(getPath('index.tmpl')))({
                suite: suite,
                version: version,
                time: new Date(),
                features: _.template(grunt.file.read(getPath('features.tmpl')))({
                    suite: suite,
                    _: _
                }),
                styles: grunt.file.read(getPath('style.css')),
                script: grunt.file.read(getPath('script.js')),
                piechart: (options.theme === 'bootstrap') ? grunt.file.read(getPath('piechart.js')) : undefined
            })
        );

        grunt.log.writeln('Generated ' + options.output + ' successfully.');
    };

};
