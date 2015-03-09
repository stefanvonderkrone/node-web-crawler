/**
 * Date: 06.01.15
 * Time: 16:53
 */

"use strict";

var q = require("q"),
    _ = require("lodash"),
    simpleGet = require("simple-get"),
    concatStream = require("concat-stream"),
    //http = require("http"),
    //https = require("https"),
    jsdom = require("jsdom"),
    CONSTANTS = {
        HTTP_PROTOCOL: "http://",
        HTTP: "http",
        HTTPS_PROTOCOL: "https://",
        HTTPS: "https"
    },
    DEFAULTS = {
        url: "",
        useHttps: true,
        includeSubdomains: true
    };

function getURL( url ) {
    return q.Promise( function( resolve, reject ) {
        simpleGet( url, function( err, res ) {
            if ( err ) {
                reject( {
                    msg: "failed getting url: " + url,
                    origError: err
                } );
            } else {
                res.pipe( concatStream( function( data ) {
                    resolve( {
                        url: url,
                        response: res,
                        data: data
                    } );
                } ) );
            }
        } );
    } );
}

function beginsWith( prefix, s ) {
    //console.log( "beginsWith", prefix, s );
    return prefix === s.substr(0, prefix.length);
}

function endsWith( suffix, s ) {
    //console.log( "endsWith", suffix, s )
    return suffix === s.substr(s.length - suffix.length );
}

function removeTrailingSlashes( s ) {
    //console.log( "removeTrailingSlashes", s );
    while( endsWith( "/", s ) ) {
        s = s.substr( 0, s.length - 1 );
    }
    return s;
}

function removeHash( s ) {
    return s.split("#")[0];
}

function validateURL( url, useHttps ) {
    var protocol = _.reduce(
        [ CONSTANTS.HTTP_PROTOCOL, CONSTANTS.HTTPS_PROTOCOL ],
        function( acc, p ) {
            if ( beginsWith( p, url ) ) {
                return p;
            }
            return acc;
        },
        ""
    );
    //console.log( "validateURL", url, useHttps );
    if ( !protocol && url.indexOf(":") >= 1 ) {
        return url;
    }
    return (useHttps ?
        CONSTANTS.HTTPS_PROTOCOL :
        CONSTANTS.HTTP_PROTOCOL) + url.substr( protocol.length );
}

function parseCharset(headers) {
    var contentType;
    if ( "content-type" in headers ) {
        contentType = headers["content-type"];
        if ( contentType.indexOf( "charset" ) >= 0 ) {
            return contentType
                .split(" ").join("")
                .split( "charset=" )[1]
                .split(";")[0];
        }
    } else {
        return undefined;
    }
}

function isHtml(headers) {
    var contentType;
    if ( "content-type" in headers ) {
        contentType = headers["content-type"];
        return contentType.indexOf( "text/html" ) >= 0;
    } else {
        return false;
    }
}


/**
 *
 * @param options
 */
function crawl( options ) {
    var cache = [],
        url, opts;
    if (_.isString( options ) ) {
        url = options;
        opts = _.assign( {}, DEFAULTS );
    } else {
        opts = _.assign( _.assign({}, DEFAULTS), options || {} );
        url = options.url;
    }

    function parseHtml( baseURL, opts, htmlString ) {
        return q.Promise( function( resolve, reject ) {
                jsdom.env(
                    htmlString,
                    ["http://code.jquery.com/jquery.js"],
                    function( err, window ) {
                        if ( err ) {
                            reject( {
                                msg: "Failed parsing DOM from url: " + baseURL,
                                origError: err
                            } );
                        } else {
                            resolve( window );
                        }
                    }
                );
            } )
            .then( function( window ) {
                return _.chain( window.$("a") )
                    .map( function( a ) {
                        return window.$(a).attr("href");
                    } )
                    .filter( function( url ) {
                        return !!url;
                    } )
                    .map( function( url ) {
                        if ( beginsWith( "/", url ) ) {
                            url = baseURL + url;
                        }
                        return validateURL(
                            removeTrailingSlashes(
                                removeHash( url )
                            ),
                            opts.useHttps
                        );
                    } )
                    .uniq()
                    .filter( function( url ) {
                        //console.log("url:", url, baseURL !== url,
                        //!_.contains( cache, url ),
                        //beginsWith( baseURL, url ));
                        return baseURL !== url &&
                            !_.contains( cache, url ) &&
                            beginsWith( baseURL, url );
                    } )
                    .value();
            } )
            .then( function( urls ) {
                cache = cache.concat( urls );
                return q.all( _.map( urls, function( url ) {
                    return getURL( url )
                        .then( function( o ) {
                            return handleInitial( opts, o );
                        }, function() {
                            return url;
                        } );
                } ) );
            } );
    }

    function handleInitial( opts, o ) {
        var headers = o.response.headers,
            charset = parseCharset( headers ),
            isHTML = isHtml( headers);
        console.log( o.url );
        return q.all( [ o.url ].concat( isHTML ? parseHtml( opts.url, opts, o.data.toString( charset ) ) : [] ) )
            .then( _.flatten );
    }

    return q.Promise( function( resolve, reject ) {
        if ( url === "" ) {
            reject( "No URL given!" );
        } else {
            getURL( validateURL( url, opts.useHttps ) )
                .then(function( o ) {
                    return handleInitial( opts, o );
                })
                .then(resolve, reject);
        }
    } );
}

module.exports = crawl;