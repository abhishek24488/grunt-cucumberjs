'use strict';

var jsonFile = require('jsonFile');
var _ = require('underscore');
var commondir = require('commondir');
var fs = require('fs');

/**
 * Generate html report
 *
 * @param {object} featureOutput Features result object
 * @param {string} logOutput Contains any console statements captured during the test run
 */
var generateReport = function(options) {

    var featureOutput = jsonFile.readFileSync(options.jsonFilePath);
    
    var suite = {
        name: jsonFile.readFileSync('package.json','utf8').name,
        features: {
            featureOutput: featureOutput,
            isFailed: false,
            passed: 0,
            failed: 0
        },
        passed: 0,
        failed: 0,
        scenarios: {
            passed: 0,
            failed: 0,
            skipped: 0,
            notdefined: 0
        }
    };

    var getPath = function(name) {
        return 'node_modules/grunt-cucumberjs/templates/' + options.theme + '/' + name;
    };

    /**
     * Adds passed/failed properties on features/scenarios
     *
     * @param {object} suite The test suite object
     */
    var setStats = function(suite) {
        var featureOutput = suite.features.featureOutput;
        var features = suite.features;
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
            features.isFailed = false;

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
                                var stepData = step.embeddings[0],
                                    name = step.name && step.name.split(' ').join('_') || step.keyword.trim();
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
                    features.isFailed = true;
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

            if (features.isFailed) {
                features.failed++;
                suite.failed++;
            } else {
                features.passed++;
                suite.passed++;
            }

            if (options.reportSuiteAsScenarios) {
                suite.failed = suite.scenarios.failed;
                suite.passed = suite.scenarios.passed;
            }

            return suite;

        });

        suite.features = features;

        return suite;
    };

    suite = setStats(suite);
    console.log('path == ', getPath('index.tmpl'));
    var a = [];
    a.push();
    
    fs.writeFileSync(
        options.output,
        _.template(fs.readFileSync(getPath('index.tmpl'),'utf-8'))({
            suite: suite,
            version: '1.0',
            time: new Date(),
            features: _.template(fs.readFileSync(getPath('features.tmpl'),'utf-8'))({
                suite: suite,
                _: _
            }),
            styles: fs.readFileSync(getPath('style.css'), 'utf-8'),
            script: fs.readFileSync(getPath('script.js'), 'utf-8'),
            piechart: (options.theme === 'bootstrap') ? fs.readFileSync(getPath('piechart.js'), 'utf-8') : undefined
        })
    );

    console.log('Generated ' + options.output + ' successfully.');
};

function generate(options) {
    console.log('options:::: ', options);
    if(!options.theme) {
        options.theme = 'bootstrap';
    }
    return generateReport(options)
}

module.exports = {
    generate: generate
};
