/**
 * Date: 06.01.15
 * Time: 17:23
 */
"use strict";

var crawler = require("./index.js");

crawler( {
    url: "http://www.innovationlab.de/",
    useHttps: false
} )
    .then( function( res ) {
        console.log( "done:" );
        res.forEach( function( url ) {
            console.log( url );
        } );
    }, function( error ) {
        console.log( "An Error occurred:" );
        console.log( error );
    } );
