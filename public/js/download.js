var browser = {
	versions: function () {
		var u = navigator.userAgent, app = navigator.appVersion;
		return { //移动终端浏览器版本信息 
		ios: !!u.match(/Mac OS X/), //ios终端 
		android: u.indexOf('Android') > -1 || u.indexOf('Linux') > -1, //android终端或uc浏览器 
		iPhone: u.indexOf('iPhone') > -1, //是否为iPhone或者QQHD浏览器 
		iPad: u.indexOf('iPad') > -1, //是否iPad 
		};
	}(),
}
function download() {
	if (browser.versions.iPhone || browser.versions.iPad || browser.versions.ios) {
		window.location.href = "https://appsto.re/cn/Ueu1ab.i";
	} else {
		window.location.href = "http://fir.im/a5nu";
	}
}
