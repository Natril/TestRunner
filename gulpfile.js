var gulp = require('gulp');
var fs = require('fs');
var filePath = require('path');
var jasmine = require('gulp-jasmine');
var jasmineReporters = require('jasmine-reporters');
var markdownTestReporter = require('./reporters/MarkdownTestReporter.js');
var homePath = '.';
var grammarPath = './grammar';
var ReadMe = "README";
var GrammarFileExtension = ".pegjs";
var parsersPath = "./parsers";

gulp.task('smith', function () {
	var smith = require('gulpsmith');
	var markdown = require('metalsmith-markdown');
	var layouts = require('metalsmith-layouts');
	var title = require('metalsmith-title');

	gulp.src('help/**/*.md')
			   .pipe(
			   	smith()
				.use(markdown({
					'gfm' : false,
					'pedantic' : true,
					'sanitize' : true,
					'smartypants' : true 

				}))
				.use(title())
				.use(function (files) {
					var fileCollection = [];
					for (var currentFile in files) {
						fileCollection.push({'path' : '/help/' + currentFile, 'title' : files[currentFile].title});
					}

					for (var currentFile in files) {
						files[currentFile].sitemap = fileCollection;
					}
				})
				.use(layouts({
					'engine' : 'handlebars',
					'directory' : './help',
					'default' : 'doc_layout.html'
				}))

			   )
			   .pipe(gulp.dest('./user_panel/help'));

	gulp.src('help/doc.css').pipe(gulp.dest('./user_panel/help'));
	gulp.src('help/images/*.*').pipe(gulp.dest('./user_panel/help/images'));
});

gulp.task('docs', function () {
	var getReadMeFiles = function (path) {
		var fileObject = fs.statSync(path);
		var requestedFiles = [];
		if (fileObject.isDirectory()) {
			fs.readdirSync(path).filter(function (file) {
				var dirContentObject = fs.statSync(path.concat('/', file));
				if (dirContentObject.isFile()) {
					if (file == ReadMe) {
						requestedFiles.push(path.concat('/',file));
					}
				} else if (dirContentObject.isDirectory()) {
					requestedFiles = requestedFiles.concat(getReadMeFiles(path.concat('/', file)));
				}
			});
		} 

		return requestedFiles;
	};

	var ReadMeFiles = getReadMeFiles(homePath); 
	var panDoc = require('child_process').spawnSync;
	var processSettings = {
		"cwd" : __dirname,
		"timeout" : 15000,
		"encoding" : "utf8"
	};

	var processInfo = panDoc('pandoc', ReadMeFiles.concat("-s","-S", "--toc", "-c", "pandoc.css", "-o", "./docs/ReadMe.html"));
	if (processInfo.status > 0) {
		var StringDecoder = require('string_decoder').StringDecoder;
		var decoder = new StringDecoder('utf8');
		console.log(decoder.write(processInfo.stderr));
		console.log(decoder.write(processInfo.stdout));
		throw "Documentation generation error!";
	}

	var Docco = require('gulp-docco');

	gulp.src('./src/*.js').pipe(Docco()).pipe(gulp.dest('docs/docco'));	
});

gulp.task('parsers', function () {
	var PEG = require('pegjs');
	var getGrammarFiles = function (path) {
		var requiredFiles = [];
		var grammarDirStat = fs.statSync(path);
		if (grammarDirStat.isDirectory()){
			fs.readdirSync(path).filter(function(file) {
				if (filePath.extname(file) == GrammarFileExtension) {
					requiredFiles.push(path.concat('/', file));
				}
			});
		}

		return requiredFiles;
	};

	var grammarFiles = getGrammarFiles(grammarPath);
	builderOptions = {
		"output" : "source"
	};

	grammarFiles.forEach(function (grammarFile) {
		var grammar = fs.readFileSync(grammarFile, {"encoding" : "utf8", "flag" : "r"});
		var parser = PEG.buildParser(grammar, builderOptions);
		parser = "module.exports = " + parser;
		var parserFile = filePath.join(parsersPath, filePath.basename(grammarFile, '.pegjs') + ".js");
		fs.writeFileSync(parserFile, parser);
	});
});

gulp.task('lib', function () {
	var Uglifier = require('node-uglifier');
	try {
		uglyRunner = new Uglifier('src/redisLauncher.js');
		uglyRunner.merge().uglify();
		uglyRunner.exportToFile('dockerfile/testerimage/resources/interpreter/interpreter.js');
        uglyLauncher = new Uglifier("src/script_launcher.js");
        uglyLauncher.merge().uglify();
        uglyLauncher.exportToFile('dockerfile/testerimage/resources/interpreter/launcher.js');
	} catch (e) {
		console.log(e);
	}

	gulp.src('lib/robot.html').pipe(gulp.dest('dockerfile/testerimage/resources/lib'));
    gulp.src('./package.json').pipe(gulp.dest('dockerfile/testerimage/resources'));
});

gulp.task('install', function () {
	var install = require('gulp-install');
	gulp.src('./package.json').pipe(install());
});

gulp.task('build', ['parsers', 'docs', 'lib', 'jrobot']);

gulp.task('docker', ['preparebuild'], function (callback) {
	var spawn = require('child_process').spawn;
	var path = require('path');
	var dockerProcess = spawn('docker', [ 'build', '-t', 'ftest/node', '.'], {'cwd' : path.resolve('dockerfile')});
	dockerProcess.stdout.on('data', function (data) {
		console.log(data.toString());
	});

	dockerProcess.stderr.on('data', function (data) {
		console.log(data.toString());
	});

	dockerProcess.on('close', function (err) {
		var exitMessage = null;
		if (err) {
			exitMessage = 'Сбор образа завершился с ошибкой';
		}

		callback(exitMessage);
	});
});

gulp.task('test', function () {
	gulp.src('./tests/specs/**/*Spec.js').pipe(jasmine({"verbose" : true}));
});

gulp.task('test-doc', function () {
	//console.log(markdownTestReporter);
	var reporter = new markdownTestReporter(filePath.join(__dirname, 'docs', 'specs', 'test.txt'));
	//console.log(reporter);
	//lvar reporter = new jasmineReporters.NUnitXmlReporter({'savePath' : filePath.join(__dirname, 'docs', 'specs')});
	//gulp.src('./tests/specs/validatorSpec.js').pipe(jasmine({"verbose" : true, "reporter" : reporter}));
	//gulp.src('./tests/specs/resolverSpec.js').pipe(jasmine({"verbose" : true, "reporter" : reporter}));
	gulp.src('./tests/specs/*Spec.js').pipe(jasmine({"verbose" : true, "reporter" : reporter}));
	/*var sed = require('child_process').spawnSync;
	var processSettings = {
		"cwd" : __dirname,
		"timeout" : 15000,
		"encoding" : "utf8"
	};

	var processInfo = sed('sed', [].concat('2s/^/<?xml-stylesheet type="text\\/xsl" href="nunit.xsl" ?>\\n/', "docs/specs/nunitresults.xml"));
	var StringDecoder = require('string_decoder').StringDecoder;
	var decoder = new StringDecoder('utf8');
	if (processInfo.status > 0) {
		console.log(decoder.write(processInfo.stderr));
		console.log(decoder.write(processInfo.stdout));
		throw "Documentation generation error!";
	}	

	fs.writeFileSync('docs/specs/spec.xml', decoder.write(processInfo.stdout), 'utf8');*/
});

gulp.task('check', function () {
	var jshint = require('gulp-jshint');
	var stylish = require('jshint-stylish');
	return gulp.src(['./src/*.js', './lib/*.js', './tests/specs/**/*.js'])
				 .pipe(jshint())
				 .pipe(jshint.reporter(stylish));
});

gulp.task('jrobot', function (callback) {
	var spawn = require('child_process').spawn;
	var path = require('path');
	var rename = require('gulp-rename');
	var gradleProcess = spawn('/bin/bash', [path.resolve('jrobot/gradlew'),  'fatJar'], {'cwd' : path.resolve('jrobot')});
	gradleProcess.stdout.on('data', function (data) {
		console.log(data.toString());
	});

	gradleProcess.stderr.on('data', function (data) {
		console.log(data.toString());
	});

	gradleProcess.on('close', function (err) {
		var errorMessage = null;
		if (err) {
			errorMessage = "Сборка робота завершилась с ошибкой";
		} else {
			gulp.src('./jrobot/build/libs/jrobot-all-0.0.1.jar')
				.pipe(rename('jrobot.jar'))
				.pipe(gulp.dest('./dockerfile/testerimage/resources'));	
		}

		callback(errorMessage);

	});
});


gulp.task('run', function (callback) {
	var exec = require('child_process').exec;
	var path = require('path');
	exec(path.resolve('delete_container.sh') + ' node', function (err, stdout, stderr) {
		if (err) {
			console.log(stdout);
			console.log(stderr);
			callback(err);
		} else {
			exec('docker run --name node -v ' + path.resolve('.') + ':' + path.resolve('.') + ':ro -p 4444:4444 -p 8000:8000 -p 6080:6080 -d ftest/node', function (err, stdout, stderr) {
				console.log(stdout);
				console.log(stderr);
				callback(err);
			});
		}
	});
});

gulp.task('kill', function (callback) {
	var spawn = require('child_process').spawn;
	var killProcess = spawn('docker', ['exec', 'node', '/bin/bash', '/runvncserver/kill.sh']);
	killProcess.stdout.on('data', function (data) {
		console.log(data.toString());
	});

	killProcess.stderr.on('data', function (data) {
		console.log(data.toString());
	});

	killProcess.on('close', function(exitCode) {
		callback();
	});
});

gulp.task('rerun', ['run']);
