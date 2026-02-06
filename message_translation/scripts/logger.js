const APPNAME = 'RealTimeTranslation';


export default {
    ContextLogger:function(module) {
        this.logprefix = APPNAME + ':' + module + ':';
        this.__LogMessage = function (message) {
            return `${this.logprefix}${message}`;
        };
        this.log = function (message) {
            console.log(this.__LogMessage(message));
        };
        this.debug = function (message) {
            console.debug(this.__LogMessage(message));
        };
        this.info = function (message) {
            console.info(this.__LogMessage(message));
        };
        this.warn = function (message) {
            console.warn(this.__LogMessage(message));
        };
        this.error = function (message) {
            console.error(this.__LogMessage(message));
        };
    }
}

