/*
	移动端mini播放器
	note：使用了库提供的事件处理封装。触发自定义事件时用triggerHandler，不能用trigger，否则在Android4.2以下会出现无法播放的情况。
*/
(function(window){
	var _URL_PLAYERSWF = "http://p0.qhimg.com/s/t0195efbf0edefb77a2/_onebox/swf/20131201/sm_player.swf";
	var _EMPTY_SOUND_URL = "http://music.so.com/empty/empty.mp3";
	var _URL_GETINFOBYID = "http://s.music.so.com/player/song";

	var 
		isMobile = true,
		isplayinit = false,
		// 音频设置启动配置
		soundManagerConf = {
			
			// pc下优先使用flash，移动终端使用html5
			preferFlash : !isMobile,
			useHTML5Audio : isMobile,

			allowScriptAccess: 'always',
			flashVersion : 9,
			// wmode : null,
			flashLoadTimeout : 5000,
			// noSWFCache : true,// 有bug，设置无效。手动改动url
			// 回调间隔
			flashPollingInterval : (isMobile?600:300),
			html5PollingInterval : (isMobile?600:300),

			/*debugFlash : true,
			debugMode : true,
			useConsole : false,*/
			// noSWFCache : true,// 有bug，设置无效。手动改动url
			url : _URL_PLAYERSWF
		},

		// 音频设备格式支持配置
		soundManagerAudioFormat = {
			'mp3': {
				'type': ['audio/mpeg; codecs="mp3"', 'audio/mpeg', 'audio/mp3', 'audio/MPA', 'audio/mpa-robust'],
				'required': true
			},
			'mp4': {
				'related': ['aac','m4a'],
				'type': ['audio/mp4; codecs="mp4a.40.2"', 'audio/aac', 'audio/x-m4a', 'audio/MP4A-LATM', 'audio/mpeg4-generic','application/octet-stream'],
				'required': true
			}
			// 'ogg': {
			// 'type': ['audio/ogg; codecs=vorbis'],
			// 'required': false
			// },
			// 'wav': {
			// 'type': ['audio/wav; codecs="1"', 'audio/wav', 'audio/wave', 'audio/x-wav'],
			// 'required': false
			// }
		},

		// 歌曲默认配置
		defaultSoundConf = {
			id: '',
			url: '',
			volume: 50,
			stream: true,
			autoLoad : true, //需要为true
			autoPlay : false
		};


	var PlayBox = function(opt){
		var pm = this._playManager = $('<div>'); // 借用库的自定义事件

		initSoundManager(pm);

		pm.playboxElement = $(opt.playboxElement || document.body);

		pm.opt = $.extend({
			'id': '',
			'playboxElement': document,
			'playItemSelecter': 'li',
			'pluginList': ['playlist', 'player', 'position']
		}, opt);

		pm.soundConf = $.extend({}, defaultSoundConf, opt.soundConf);

		pm.soundManager.onready(function(){
			$(pm.opt.pluginList).each(function(index, item){
				item in PlayBox.PLUGINS && PlayBox.PLUGINS[item](pm);
			});

			pm.triggerHandler('playboxready');
		});
		pm.soundManager.ontimeout(function(){
			pm.triggerHandler('playboxtimeout');
		});

	};

	$.extend(PlayBox.prototype, {
		'play': function(id, isaction){
			var pm = this._playManager;

			if (id) {
				preDo4Play(id, pm, isaction);
			} else {
				pm.soundObject && pm.triggerHandler('play');
			}
		},
		'pause': function(){
			var pm = this._playManager;

			pm.triggerHandler('pause');
		},
		'stop': function(){
			var pm = this._playManager;

			pm.triggerHandler('stop');
		}
	});

	/*
	* pm = {
		soundObject
		soundConf
		soundInfo
		opt
		playItemElement
		playboxElement
		}
	*/
	PlayBox.PLUGINS = {
		'player': function(pm){
			pm.on('play', function(){
				var oSound = pm.soundObject;
				if ( oSound && !oSound._native) {
					oSound._native = false;
					oSound.playState == 0 ? oSound.play() : oSound.resume();
				}

			}).on('pause', function(){
				var oSound = pm.soundObject;
				if (oSound && !oSound._native) {
					oSound._native = false;
					oSound.pause();
				}
			}).on('stop', function(){
				var oSound = pm.soundObject;
				if (oSound && !oSound._native) {
					oSound._native = false;
					oSound.stop();
				}
			}).on('loadfail failure', function(e){
				var oSound = pm.soundObject;
				if (oSound && !oSound.loaded && !oSound._native) { // 移动端chrome32里有误触发，增加loaded判断
					oSound._native = false;
					oSound.stop();
					oSound.unload();
					oSound.destruct();
					pm.soundObject = null;
				}
			});
		},
		'playlist': function(pm){
			pm.on('start', function(e, data){
				var id = data && data.id;

				if (!id) { return; }

				preDo4Play(id, pm, true);
				
			}).on('soundready', function(e,d){
				pm.soundInfo = d;

				if (isplayinit) {
					var soundConf = $.extend({}, pm.soundConf, {
						url : d.playlinkUrl.indexOf('&_t=') != -1?d.playlinkUrl.split('&_t=')[0]:d.playlinkUrl,
						id : d.songId
					});

					if (soundManager.canPlayURL(soundConf.url)) {
						pm.soundObject = pm.soundManager.createSound(soundConf);
						pm.soundObject && bindPlayEvent(pm);
					} else {
						setTimeout(function(){
							pm.triggerHandler('failure');
						}, 0);
					}
				}

			}).on('playboxready', function(){
				var id = pm.opt.id;
				id && preDo4Play(id, pm);
			});
		},
		'operate': function(pm){
			var root = $(pm.playboxElement);
			var playBtn = $(''); // 设置成空的$对象，省掉调用方法前的空判断。
			var activeBtn;
			var isplaying = false;

			root.on('click', '.js-360-playin', function(e){
				e.preventDefault();

				var me = $(this);
				var id = me.data('id');

				if (!id) { return; }

				if(me.hasClass('pause')){
					pm.triggerHandler('pause');
				} else {
					activeBtn = me;
					if (!pm.soundObject || playBtn[0] != activeBtn[0]) {
						pm.triggerHandler('stop');
						if(pm.soundObject){
							pm.soundObject = null;
						}
						pm.triggerHandler('start', {"id": id});
					} else {
						pm.triggerHandler('play');
					}
				}
				
			});

			pm.on('start', function(){
				playBtn = activeBtn;
				isplaying = false;
				pm.playItemElement = activeBtn.closest(pm.opt.playItemSelecter);
				playBtn.addClass('pause');
				playBtn.addClass('animation');
			}).on('play', function(){
				playBtn.addClass('pause');
				!isplaying && playBtn.addClass('animation');
			}).on('pause', function(){
				playBtn.removeClass('pause');
				playBtn.removeClass('animation');
			}).on('stop', function(){
				playBtn.removeClass('pause');
				playBtn.removeClass('animation');
			}).on('finish', function(){
				playBtn.removeClass('pause');
				playBtn.removeClass('animation');
			}).on('loadfail failure soundfail', function(){
				playBtn.removeClass('pause');
				playBtn.removeClass('animation');
			}).on('startplaying', function(){
				playBtn.removeClass('animation');
				isplaying = true;
			});
		},
		'position': function(pm){
			
			var isplaying = false;
			var positionWrap,
				// 播放器加载进度条
				playerLoadEle = $(''),
				// 播放器播放进度
				playerPositionEle = $('');
				

			function showPosition(percent,isAnmi){
				if(!pm.position.showPositionStop && percent !== false){
					if(isAnmi){
						playerPositionEle.animate({
							'width' : percent+'%'
						},100);
					}else{
						playerPositionEle.width(percent+'%');
					}
				}
			}

			function showLoaded(t,isAnmi){
				if(t && t.bytesLoaded && t.bytesTotal){
					var percent = Math.ceil(t.bytesLoaded/t.bytesTotal*100);
					if(isAnmi){
						playerLoadEle.animate({
							'width' : percent+'%'
						},100);
					}else{
						playerLoadEle.width(percent+'%');
					}
				}
			}

			pm.on('play', function(){

			}).on('whileloading load', function(){
				showLoaded(pm.soundObject);
			}).on('whileplaying', function(){
				if (!isplaying) {
					isplaying = true;
					pm.triggerHandler('startplaying');
				}
				var percent = getSoundPercent(pm.soundObject);
				showPosition(percent);
			}).on('finish stop loadfail failure', function(){
				showPosition(0);
				playerLoadEle.width(0);

				pm.position.showPositionStop = false;
				isplaying = false;
			}).on('start', function(){
				positionWrap = pm.playItemElement,
				playerLoadEle = $('.js-player-loaded', positionWrap),
				playerPositionEle = $('.js-player-position', positionWrap);

				pm.position = {
					showPositionStop: false
				};
			}).on('soundready', function(){
				pm.soundObject && pm.soundObject.loaded && playerLoadEle.width('100%');
			});
		},
		'autoplay': function(pm){
			pm.on('soundready', function(){
				setTimeout(function(){
					if(pm.soundObject){
						// html5时，canplay后再触发play，否则可能无法播放。
						if (!pm.soundObject.isHTML5) {
							pm.triggerHandler('play');
						} else if (pm.soundObject._html5_canplay || pm.soundObject.loaded) {
							pm.triggerHandler('play');
						} else {
							// 配置的autoLoad需要为true。
							var play = function(){
								clearTimeout(timer);
								pm.triggerHandler('play');
								pm.soundObject._iO._oncanplay = null;
							};
							var timer = setTimeout(play, 300);
							pm.soundObject._iO._oncanplay = play;
						}
					}
				}, 200);
			});
		},
		'destruct': function(pm){
			/*因资源问题，可选择播放完后销毁资源，以便下次播放*/
			pm.on('stop finish loadfail failure', function(){
				if (pm.soundObject) {
					pm.soundObject.destruct();
					pm.soundObject = null;
				}
			});
		}
	};

	function initSoundManager(pm) {
		if(!soundManager.ok()){
			soundManager.audioFormats = soundManagerAudioFormat;
			soundManager.setup(soundManagerConf);
		}

		pm.soundManager = soundManager;

		return pm;
	}

	function preDo4Play(id, pm, isaction){
		// 未播放过，且该次播放为用户行为触发，创建一首空歌曲。（针对移动端播放的限制）
		if(!isplayinit && isaction){
			var o = soundManager.createSound({
				id:0,
				url:_EMPTY_SOUND_URL,
				volume:0,
				stream:false,
				autoLoad:true,
				autoPlay:false
			});
			o.play();
			o.stop();
			o.unload();
			isplayinit = true;
		}

		var def = null;
		var songInfoList = pm.opt.songInfoList;

		if (songInfoList && songInfoList[id]) {
			def = $.Deferred(function(def){
				/*延时，否则ios下切换播放时容易失败。*/
				setTimeout(function(){
					def.resolve(songInfoList[id]);
				}, 100);
				return def.promise()
			});
		} else {
			def = $.ajax({
				url : _URL_GETINFOBYID,
				dataType : 'jsonp',
				data : {
					'id' : id,
					'projectName' : '360music'
				}
			});
		}

		return def.done(function(data){
			if(data && data.songId != undefined){
				setTimeout(function(){
					pm.triggerHandler('soundready', data);
				}, 0);
			} else {
				setTimeout(function(){
					pm.triggerHandler('soundfail', data);
				}, 0);
			}
		}).fail(function(){
			setTimeout(function(){
				pm.triggerHandler('soundfail', data);
			}, 0);
		});
	}

	function bindPlayEvent(pm){
		$.extend(pm.soundObject.options, {
			onload: function(success){
				//console.log('onload',success);
				if(success == false) {
					pm.triggerHandler('loadfail');
				} else {
					pm.triggerHandler('load');
				}
			},

			onplay: function(e){
				//console.log('onplay',e);
				if (this._native !== false) {
					this._native = true;
					pm.triggerHandler('play');
				}
				this._native = null;
			},

			onpause: function(e){
				//console.log('onpause',e);
				if (this._native !== false) {
					this._native = true;
					pm.triggerHandler('pause');
				}
				this._native = null;
			},

			onresume: function(e){
				//console.log('onresume',e);
				if (this._native !== false) {
					this._native = true;
					pm.triggerHandler('play');
				}
				this._native = null;
			},

			onstop: function(e){
				//console.log('onstop',e);
				if (this._native !== false) {
					this._native = true;
					pm.triggerHandler('stop');
				}
				this._native = null;
			},

			onfinish: function(e){
				//console.log('onfinish',e);
				pm.triggerHandler('finish');
			},

			whileloading: function(e){
				//console.log('whileloading',e);
				pm.triggerHandler('whileloading');
			},

			whileplaying: function(e){
				//console.log('whileplaying',e);
				pm.triggerHandler('whileplaying');
			},

			ondataerror: function(e){
				//console.log('ondataerror',e);
				pm.triggerHandler('dataerror');
			},

			onfailure: function(e){
				//console.log('onfailure',e);
				pm.triggerHandler('failure');
			},

			onerror: function(e){
				//console.log('onerror',e);
				pm.triggerHandler('error');
			},

			onstalled: function(e){
				if (this._a && this._a.paused) {
					pm.triggerHandler('pause');
				};
			}
		});
	}

	function getSoundPercent(oSound){
		var percent = false;
		if(oSound){
			var total = oSound.durationEstimate,
				curPosition = oSound.position;

			if(curPosition && total){
				percent = curPosition/total*100;
			}
		}
		
		return percent;
	}

	PlayBox.Helper = {
		'preDo4Play': preDo4Play,
		'bindPlayEvent': bindPlayEvent,
		'getSoundPercent': getSoundPercent
	}

	window.PlayBox = PlayBox;
})(this);