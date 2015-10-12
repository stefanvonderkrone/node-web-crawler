/**
 * Date: 09.10.15
 * Time: 15:47
 */

"use strict";

var _startsWith = require("lodash/string/startsWith"),
    _reduce = require("lodash/collection/reduce"),

    HTTP = "http://",
    HTTPS = "https://",
    PROTOCOLS = [HTTP, HTTPS];

function validateURL(url, useHttps) {
    var protocol = _reduce( PROTOCOLS, function (acc, p) {
        if ( _startsWith( url, p ) ) {
            return p;
        }
        return acc;
    }, "" );
    if (!protocol && url.indexOf(":") >= 1) {
        return url;
    }
    return (useHttps ? HTTPS : HTTP) + url.substr( protocol.length );
}

module.exports = validateURL;
