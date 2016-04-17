/**
 * Created by Michael on 31/12/13.
 */

// Returns a random integer between min (included) and max (excluded)
// Using Math.round() will give you a non-uniform distribution!
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function transform(value, percent) {
    var calced = (value - 127.5) * percent + 127.5;
    return Math.round(calced);
    //return (value - 127.5) * percent + 127.5;
    //return value;
}

var dank = new Image();
dank.src = "img/dank1.jpg";

var dank2 = new Image();
dank2.src = "img/dank2.png";

var dank3 = new Image();
dank3.src = "img/dank3.jpg";

var dank4 = new Image();
dank4.src = "img/dank4.jpg";

var dank5 = new Image();
dank5.src = "img/dank5.png";

var imageArray = [dank, dank2, dank3, dank4, dank5];

var baseImageIndex, bangImageIndex;

baseImageIndex = getRandomInt(0, imageArray.length);
bangImageIndex = getRandomInt(0, imageArray.length);
while(baseImageIndex == bangImageIndex) {
    bangImageIndex = getRandomInt(0, imageArray.length);
}

var allStreamData = null;

/**
 * The *AudioSource object creates an analyzer node, sets up a repeating function with setInterval
 * which samples the input and turns it into an FFT array. The object has two properties:
 * streamData - this is the Uint8Array containing the FFT data
 * volume - cumulative value of all the bins of the streaData.
 *
 * The MicrophoneAudioSource uses the getUserMedia interface to get real-time data from the user's microphone. Not used currently but included for possible future use.
 */
var MicrophoneAudioSource = function() {
    var self = this;
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    var analyser;

    var sampleAudioStream = function() {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i in self.streamData) {
            total += self.streamData[i];
        }
        self.volume = total;
    };

    // get the input stream from the microphone
    navigator.getMedia = (
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia
    );
    navigator.getMedia({ audio: true }, function(stream) {
        var audioCtx = new(window.AudioContext || window.webkitAudioContext);
        var mic = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        mic.connect(analyser);
        setInterval(sampleAudioStream, 20);
    }, function() { alert("error getting microphone input."); });
};

var SoundCloudAudioSource = function(player) {
    var self = this;
    var analyser;
    var audioCtx = new(window.AudioContext || window.webkitAudioContext);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    player.crossOrigin = "anonymous";
    var source = audioCtx.createMediaElementSource(player);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    var sampleAudioStream = function() {
        analyser.getByteFrequencyData(self.streamData);
        // calculate an overall volume value
        var total = 0;
        for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
            total += self.streamData[i];
        }
        self.volume = total;
        allStreamData = self.streamData;
    };
    setInterval(sampleAudioStream, 20);
    // public properties and methods
    this.volume = 0;
    this.streamData = new Uint8Array(128);
    this.playStream = function(streamUrl) {
        // get the input stream from the audio element
        player.addEventListener('ended', function() {
            self.directStream('coasting');
        });
        player.setAttribute('src', streamUrl);
        player.play();
    }
};
/**
 * Makes a request to the Soundcloud API and returns the JSON data.
 */
var SoundcloudLoader = function(player, uiUpdater) {
    var self = this;
    var client_id = "0bcdee26fb117dc0c876f8970f4257e4"; // to get an ID go to http://developers.soundcloud.com/
    this.sound = {};
    this.streamUrl = "";
    this.errorMessage = "";
    this.player = player;
    this.uiUpdater = uiUpdater;

    /**
     * Loads the JSON stream data object from the URL of the track (as given in the location bar of the browser when browsing Soundcloud),
     * and on success it calls the callback passed to it (for example, used to then send the stream_url to the audiosource object).
     * @param track_url
     * @param callback
     */
    this.loadStream = function(track_url, successCallback, errorCallback) {
        SC.initialize({
            client_id: client_id
        });
        SC.get('/resolve', { url: track_url }, function(sound) {
            if (sound.errors) {
                self.errorMessage = "";
                for (var i = 0; i < sound.errors.length; i++) {
                    self.errorMessage += sound.errors[i].error_message + '<br>';
                }
                self.errorMessage += 'Make sure the URL has the correct format: https://soundcloud.com/user/title-of-the-track';
                errorCallback();
            } else {

                if (sound.kind == "playlist") {
                    self.sound = sound;
                    self.streamPlaylistIndex = 0;
                    self.streamUrl = function() {
                        return sound.tracks[self.streamPlaylistIndex].stream_url + '?client_id=' + client_id;
                    };
                    successCallback();
                } else {
                    self.sound = sound;
                    self.streamUrl = function() {
                        return sound.stream_url + '?client_id=' + client_id; };
                    successCallback();
                }
            }
        });
    };


    this.directStream = function(direction) {
        if (direction == 'toggle') {
            if (this.player.paused) {
                this.player.play();
            } else {
                this.player.pause();
            }
        } else if (this.sound.kind == "playlist") {
            if (direction == 'coasting') {
                this.streamPlaylistIndex++;
            } else if (direction == 'forward') {
                if (this.streamPlaylistIndex >= this.sound.track_count - 1) this.streamPlaylistIndex = 0;
                else this.streamPlaylistIndex++;
            } else {
                if (this.streamPlaylistIndex <= 0) this.streamPlaylistIndex = this.sound.track_count - 1;
                else this.streamPlaylistIndex--;
            }
            if (this.streamPlaylistIndex >= 0 && this.streamPlaylistIndex <= this.sound.track_count - 1) {
                this.player.setAttribute('src', this.streamUrl());
                this.uiUpdater.update(this);
                this.player.play();
            }
        }
    }
};

/**
 * Class to update the UI when a new sound is loaded
 * @constructor
 */
var UiUpdater = function() {
    var controlPanel = document.getElementById('controlPanel');
    var trackInfoPanel = document.getElementById('trackInfoPanel');
    var infoImage = document.getElementById('infoImage');
    var infoArtist = document.getElementById('infoArtist');
    var infoTrack = document.getElementById('infoTrack');
    var messageBox = document.getElementById('messageBox');

    this.clearInfoPanel = function() {
        // first clear the current contents
        infoArtist.innerHTML = "";
        infoTrack.innerHTML = "";
        trackInfoPanel.className = 'hidden';
    };
    this.update = function(loader) {
        // update the track and artist into in the controlPanel
        var artistLink = document.createElement('a');
        artistLink.setAttribute('href', loader.sound.user.permalink_url);
        artistLink.innerHTML = loader.sound.user.username;
        var trackLink = document.createElement('a');
        trackLink.setAttribute('href', loader.sound.permalink_url);

        if (loader.sound.kind == "playlist") {
            trackLink.innerHTML = "<p>" + loader.sound.tracks[loader.streamPlaylistIndex].title + "</p>" + "<p>" + loader.sound.title + "</p>";
        } else {
            trackLink.innerHTML = loader.sound.title;
        }

        var image = loader.sound.artwork_url ? loader.sound.artwork_url : loader.sound.user.avatar_url; // if no track artwork exists, use the user's avatar.
        infoImage.setAttribute('src', image);

        infoArtist.innerHTML = '';
        infoArtist.appendChild(artistLink);

        infoTrack.innerHTML = '';
        infoTrack.appendChild(trackLink);

        // display the track info panel
        trackInfoPanel.className = '';

        // add a hash to the URL so it can be shared or saved
        var trackToken = loader.sound.permalink_url.substr(22);
        window.location = '#' + trackToken;
    };
    this.toggleControlPanel = function() {
        if (controlPanel.className.indexOf('hidden') === 0) {
            controlPanel.className = '';
        } else {
            controlPanel.className = 'hidden';
        }
    };
    this.displayMessage = function(title, message) {
        messageBox.innerHTML = ''; // reset the contents

        var titleElement = document.createElement('h3');
        titleElement.innerHTML = title;

        var messageElement = document.createElement('p');
        messageElement.innerHTML = message;

        var closeButton = document.createElement('a');
        closeButton.setAttribute('href', '#');
        closeButton.innerHTML = 'close';
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            messageBox.className = 'hidden';
        });

        messageBox.className = '';
        // stick them into the container div
        messageBox.appendChild(titleElement);
        messageBox.appendChild(messageElement);
        messageBox.appendChild(closeButton);
    };
};

window.onload = function init() {

    render();

    //var visualizer = new Visualizer();
    var player = document.getElementById('player');
    var uiUpdater = new UiUpdater();
    var loader = new SoundcloudLoader(player, uiUpdater);

    var audioSource = new SoundCloudAudioSource(player);
    var form = document.getElementById('form');
    var loadAndUpdate = function(trackUrl) {
        loader.loadStream(trackUrl,
            function() {
                uiUpdater.clearInfoPanel();
                audioSource.playStream(loader.streamUrl());
                uiUpdater.update(loader);
                setTimeout(uiUpdater.toggleControlPanel, 3000); // auto-hide the control panel
            },
            function() {
                uiUpdater.displayMessage("Error", loader.errorMessage);
            });
    };

    uiUpdater.toggleControlPanel();
    // on load, check to see if there is a track token in the URL, and if so, load that automatically
    if (window.location.hash) {
        var trackUrl = 'https://soundcloud.com/' + window.location.hash.substr(1);
        loadAndUpdate(trackUrl);
    }

    // handle the form submit event to load the new URL
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var trackUrl = document.getElementById('input').value;
        loadAndUpdate(trackUrl);
    });
    var toggleButton = document.getElementById('toggleButton')
    toggleButton.addEventListener('click', function(e) {
        e.preventDefault();
        uiUpdater.toggleControlPanel();
    });
    /*
    var aboutButton = document.getElementById('credit');
    aboutButton.addEventListener('click', function(e) {
        e.preventDefault();
        var message = document.getElementById('info').innerHTML;
        uiUpdater.displayMessage("About", message);
    });

    window.addEventListener("keydown", keyControls, false);

    function keyControls(e) {
        switch (e.keyCode) {
            case 32:
                // spacebar pressed
                loader.directStream('toggle');
                break;
            case 37:
                // left key pressed
                loader.directStream('backward');
                break;
            case 39:
                // right key pressed
                loader.directStream('forward');
                break;
        }
    }
    */
};

function render() {
    var fov = 250;
    var SC_W = 1200;
    var SC_H = 600;
    var RS = 100;
    var PLAYWIDTH = SC_W / RS;
    var PLAYHEIGHT = 50;
    var HALF_WIDTH = SC_W / 2;
    var HALF_HEIGHT = SC_H / 2;
    var screenLeft = 0.0;
    var screenTop = -10.0;
    var screenFront = 0.0;
    function convert3Dto2D(x3d, y3d, z3d) {

        var scale = fov / (fov + z3d);
        var x2d = ((x3d - HALF_WIDTH) * scale) + HALF_WIDTH;
        var y2d = ((y3d - HALF_HEIGHT) * scale) + HALF_HEIGHT - (z3d * 0.01);
        // just using a 2 dimensional array as a 2D point - not sure if that's the best way to do it! 
        return [x2d, y2d];
    }
    function noise1(x, y) {
        var xRand = getRandomInt(38, 40);
        var yRand = getRandomInt(45, 48);
        var xScale = allStreamData[xRand] / 255;
        var yScale = allStreamData[yRand] / 255;
        return Math.sin(x * xScale) * 5 + Math.sin(xScale * 3* x + y * 2) * 3;
    }
    var canvas = document.getElementById('terrain-canvas');
    var c = canvas.getContext('2d');
    function makeTheMagicHappen() {
        c.clearRect(0,0,1600,800);
        for(i = 0; i < 5; i++) {
            for(j = 0; j < 5; j++) {
                var baseImage = imageArray[baseImageIndex];
                var bangImage = imageArray[bangImageIndex];
                var image = (allStreamData[3*(5*i + j)] > 200) ? baseImage : bangImage;
                c.drawImage(image, i*width, j*height, width, height);
                var percentTransform = 1;
                var red = transform(allStreamData[3*(5*i +j)], percentTransform);;
                var green = transform(allStreamData[3*(5*i +j) + 1], percentTransform);
                var blue = transform(allStreamData[3*(5*i +j) + 2], percentTransform);
                c.fillStyle = "rgba(" + red + "," + green + "," + blue + ", 0.9)";
                var hsv = tinycolor(c.fillStyle).toHsv();
                hsv['s'] = 100;
                hsv['v'] = 100;
                c.fillStyle = tinycolor(hsv).toHex();
                c.fillStyle = tinycolor(c.fillStyle).setAlpha(0.9);
                var width = SC_W / 5;
                var height = SC_H / 5;
                c.fillRect(i * width, j * height, width, height);
            }
            c.stroke();
        }
        
        /* UNCOMMENT THIS FOR GREEN LINES */
        /*
        screenFront += 1;
        screenLeft += 1;
        c.lineWidth = 0.5;
        var slicecount = SC_W / RS;
        var leftshift = (screenLeft % 1) * RS;
        var frontshift = (screenFront % 1) * RS;
        var p2d = [0, 0];
        for (var slicez = 30; slicez >= 10; slicez--) {
            c.beginPath();
            // rudimentary frustum culling
            var edgewidth = slicez * 1.22;
            var zpos = (slicez * RS) - frontshift;
            var slicevisible = false;
            // this bit of code makes the colour fade out towards the distance.
            if (Math.abs(zpos) < 100) linecol = 0xff;
            else if (zpos > 7000) {
                // should give number from 1 - 2000;  
                linecol = (((10000 - zpos) / 3000) * 0xff);
            } else {
                linecol = 0xff;
            }
            c.strokeStyle = "rgb(0," + linecol + ",0)";
            // make sure we only oveTo the first point. 
            var firstpoint = true;
            for (var slicex = -edgewidth; slicex <= slicecount + edgewidth; slicex++) {
                var h = (noise1(slicex + screenLeft, screenFront + slicez));
                var xpos = (slicex * RS) - leftshift;
                var ypos = (h - screenTop) * RS;
                p2d = convert3Dto2D(xpos, ypos, zpos);
                if (p2d[1] > SC_H) p2d[1] = SC_H;
                else if (p2d[1] < 0) p2d[1] = 0;
                else slicevisible = true;
                if (firstpoint) {
                    c.moveTo(p2d[0], p2d[1]);
                    firstpoint = false;
                } else {
                    c.lineTo(p2d[0], p2d[1]);
                }
            }
            if (slicevisible) c.stroke();
        }*/
    }
    var loop = setInterval(function() { makeTheMagicHappen(); }, 50);
}