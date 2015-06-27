var browser = {
	versions: function () {
		var u = navigator.userAgent, app = navigator.appVersion;
		return { //移动终端浏览器版本信息 
		ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端 
		android: u.indexOf('Android') > -1 || u.indexOf('Linux') > -1, //android终端或uc浏览器 
		iPhone: u.indexOf('iPhone') > -1, //是否为iPhone或者QQHD浏览器 
		iPad: u.indexOf('iPad') > -1, //是否iPad 
		};
	}(),
}
function download() {
	if (browser.versions.iPhone || browser.versions.iPad || browser.versions.ios) {
	window.location.href = "http://www.asiayak.cn";
	}
	if (browser.versions.android) {
	window.location.href = "http://www.qq.com";
	}
}