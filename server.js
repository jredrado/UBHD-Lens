var http = require('http');
var express = require('express');
var path = require('path');
var _ = require("underscore");
var fs = require('fs');
var path = require("path");
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var sass = require('node-sass');
var browserify = require('browserify');
var methodOverride = require('method-override')

var app = express();

var port = process.env.PORT || 4001;
app.use(cookieParser());
app.use(bodyParser());
app.use(methodOverride());


app.get('/lens.js', function (req, res, next) {
  browserify({ debug: true, cache: false })
    .add(path.join(__dirname, "boot.js"))
    .bundle()
    .on('error', function(err, data){
      console.error(err.message);
      res.send('console.log("'+err.message+'");');
    })
    .pipe(res);
});

var handleError = function(err, res) {
  console.error(err);
  res.status(400).json(err);
};

var renderSass = function(cb) {
  sass.render({
    file: path.join(__dirname, "lens.scss"),
    sourceMap: true,
    outFile: 'lens.css',
  }, cb);
};

app.get('/lens.css', function(req, res) {
  renderSass(function(err, result) {
    if (err) return handleError(err, res);
    res.set('Content-Type', 'text/css');
    res.send(result.css);
  });
});

app.get('/lens.css.map', function(req, res) {
  renderSass(function(err, result) {
    if (err) return handleError(err, res);
    res.set('Content-Type', 'text/css');
    res.send(result.map);
  });
});

app.get('/urs', function(req, res) {
  let url = req.query.url;
  let pub_id = url.match(/web\+urs:(.*)/)[1];
 
    var data = '';

    var options = {
      host: 'localhost',
      path: '/pub/' + pub_id + '/resolve',
      port: 3001
    };

    var callback = function(response) {
      response.on('data', function (chunk) {
        data += chunk;
      });

      response.on('end', function () {
        console.log(data);
        let json_response = JSON.parse(data);

        let redirect_url = '/readium-viewer/?manifest=true&href='+ encodeURIComponent(json_response[0].endpoint);
        res.redirect(redirect_url);
      });
    }

    var req = http.request(options, callback);
    req.end();

});

// Serve files from root dir
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'readium-viewer')));


// Serve Lens in dev mode
// --------

//app.use(app.router);

http.createServer(app).listen(port, function(){
  console.log("Lens running on port " + port);
  console.log("http://127.0.0.1:"+port+"/");
});
