/**
 * Date: 09.10.15
 * Time: 15:42
 */

"use strict";

var q = require("q"),
    _ = require("lodash"),
    simpleGet = require("simple-get"),
    concatStream = require("concat-stream");

/**
 *
 * @param {string} url
 * @returns {Promise.<{url:string,response: object, data: object}>}
 */
function getURL( url ) {
    console.log( "getURL:", url );
    return q.Promise(function (resolve, reject) {
        simpleGet({
            url: url,
            headers: {
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36"
            }
        }, function (err, res) {
            if (err) {
                reject({
                    msg: "failed getting url: " + url,
                    origError: err
                });
            } else {
                res.pipe(concatStream(function (data) {
                    resolve({
                        url: url,
                        response: res,
                        data: data,
                        success: true
                    });
                }));
            }
        });
    });
}

module.exports = getURL;
