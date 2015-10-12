
"use strict";

var q = require("q"),
    _ = require("lodash"),
    jsdom = require("jsdom"),

    getURL = require("./getURL"),
    validateURL = require("./validateURL"),

    JQUERY = "http://code.jquery.com/jquery.js",
    CONSTANTS = {
        HTTP_PROTOCOL: "http://",
        HTTP: "http",
        HTTPS_PROTOCOL: "https://",
        HTTPS: "https"
    },
    DEFAULTS = {
        useHttps: true,
        includeSubdomains: true
    };

function removeTrailingSlashes(s) {
    while (_.endsWith(s, "/")) {
        s = s.substr(0, s.length - 1);
    }
    return s;
}

function removeHash(s) {
    return s.split("#")[0];
}

function parseCharset(headers) {
    var contentType;
    if ("content-type" in headers) {
        contentType = headers["content-type"];
        if (contentType.indexOf("charset") >= 0) {
            return contentType
                .split(" ").join("")
                .split("charset=")[1]
                .split(";")[0];
        }
    } else {
        return undefined;
    }
}

function isHtml(headers) {
    var contentType;
    if ("content-type" in headers) {
        contentType = headers["content-type"];
        return contentType.indexOf("text/html") >= 0;
    } else {
        return false;
    }
}

/**
 *
 * @param url
 * @returns {boolean}
 */
function startsWithHttpProtocol(url) {
    return _.startsWith( url, CONSTANTS.HTTP_PROTOCOL ) || _.startsWith( url, CONSTANTS.HTTPS_PROTOCOL );
}

function getDomain( url ) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if ( url.indexOf("://") >= 0) {
        domain = url.split("://")[1];
    }
    domain = (domain || url).split('/')[0];

    //find & remove port number
    domain = domain.split(':')[0];

    return domain;
}

function matchesDomain(baseURL, url) {
    var baseDomain = getDomain( baseURL ),
        domain = getDomain( url );
    return baseDomain === domain;
}

function hasProtocol(url) {
    var protocol = url.split(":")[0];
    return protocol.indexOf("/") < 0;
}

function parseURLs(baseURL, options, htmlString) {
    return q.denodeify( jsdom.env )( htmlString, [ JQUERY ] )
        .then( function( window ) {
            return _.chain( window.$("a") )
                .map( function( anchorElement ) {
                    return window.$(anchorElement).attr("href");
                } )
                .uniq()
                .filter( function( url ) {
                    if ( startsWithHttpProtocol( url ) ) {
                        return matchesDomain( baseURL, url );
                    }
                    return !!url && !hasProtocol( url );
                } )
                .map( function( url ) {
                    if (_.startsWith( url, "/" ) ) {
                        url = baseURL + url;
                    } else {
                        url = validateURL( removeHash( url ), options.useHttps );
                        if ( !startsWithHttpProtocol( url ) ) {
                            url = baseURL + url;
                        }
                    }
                    return removeTrailingSlashes( url );
                } )
                .value();
        }, function( err ) {
            return q.reject( {
                msg: "Failed parsing DOM from url: " + baseURL,
                error: err
            } );
        } )
}

function parseResult(baseURL, options, result) {
    var headers = result.response.headers,
        charset = parseCharset( headers),
        htmlString;
    if ( isHtml( headers ) ) {
        try {
            htmlString = result.data.toString(charset);
        } catch (e) {
        }
    }
    if ( htmlString ) {
        return parseURLs( baseURL, options, htmlString );
    } else {
        return q([]);
    }
}
/**
 * @param {string} baseURL
 * @param {object} options
 * @param {boolean} options.useHttps
 * @param {boolean} options.includeSubdomains
 * @param {Array.<string>} cache
 * @param {object} result
 * @returns {Promise}
 **/
function handleResult( baseURL, options, cache, result ) {
    if ( !result.success ) {
        return q( [ result.url ] );
    }
    return parseResult( baseURL, options, result )
        .then( function( parsedURLs ) {
            return q.all(
                _.chain( parsedURLs )
                    .filter( function( url ) {
                        return !_.contains( cache, url );
                    } )
                    .map( function( url ) {
                        cache.push( url );
                        return getURL(url)
                            .then(
                                _.partial( handleResult, baseURL, options, cache )

                            /*function (result) {
                                if (result.response.statusCode >= 400) {
                                    return url;
                                } else {
                                    if (isHtml(result.response.headers)) {
                                        return handleInitial(opts, result);
                                    } else {
                                        return undefined;
                                    }
                                }
                            }*/

                            , function () {
                                return {
                                    url: url,
                                    success: false
                                };
                            });
                    } )
                    .value()
            );
        } );
}

/**
 * @param {string} url
 * @param {object} options
 * @param {boolean} options.useHttps
 * @param {boolean} options.includeSubdomains
 *
 * flow:
 * - getURL
 * - parseResult for links
 * - filter links
 * - getURL recursive
 * - vice versa
 *
 * -->
 *  crawl baseUrl opts cache url = do
 *      content <- getUrl opts url
 *      if isHtml content
 *          then
 *              cache' = url : cache
 *              crawl' cache url = do
 *                  if not (url `elemOf` cache)
 *                      then crawl baseUrl opts cache url
 *                      else return cache
 *              urls = getFilteredLinks baseUrl cache' content
 *              return foldM crawl' cache urls
 *          else
 *              return cache
 *
 **/
function crawl(url, options) {
    url = validateURL( url, options.useHttps );
    var cache = [ url ];
    return getURL( url )
        .then( _.partial( handleResult, url, options, cache ) )
        .then( undefined, function( err ) {
            //console.log( err );
            throw err;
        } )
        .then( function() {
            //console.log( "\n############\n" );
            //console.log( "result:", result );
            //console.log( "\n############\n" );
            //console.log( "cache:", cache );
            return cache.sort();
        } )
        .then( undefined, function( err ) {
            console.log("error crawl:", err );
            throw err;
        });
}

/**
 * @param {string} url
 * @param {?object} options
 * @param {?boolean} options.useHttps
 * @param {?boolean} options.includeSubdomains
 * @returns {Promise}
 **/
module.exports = function nodeWebCrawl(url, options) {
    if (arguments.length === 2) {
        return crawl(url, _.reduce(DEFAULTS, function (o, v, k) {
            if (options.hasOwnProperty(k)) {
                if ( typeof v === "boolean" ) {
                    o[k] = !!options[k];
                }
            } else {
                o[k] = v;
            }
            return o;
        }, {}));
    } else if (arguments.length === 1) {
        return crawl(url, _.clone(DEFAULTS, true));
    } else {
        return q.reject(new Error("invalid number of arguments"));
    }
};
