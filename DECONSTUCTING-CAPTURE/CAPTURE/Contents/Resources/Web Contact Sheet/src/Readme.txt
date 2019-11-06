This source code for the slimbox is the official one manually patched with two patches found here:
https://github.com/cbeyls/slimbox/issues/24

The patches downscales the image until it can fit in the browser window.
The code has been modified further to make space for the close-bar at the bottom.

To produce the final js file, the source file should be run through the YUI Compressor:
http://yui.github.io/yuicompressor/
E.g.:
"java -jar yuicompressor-2.4.8.jar slimbox2.js -o slimbox2-min.js"
