/**
 * Date: 06.01.15
 * Time: 17:23
 */
"use strict";

var crawler = require("./index.js");

crawler( "https://www.enviam.de/", {
    useHttps: true
} )
    .then( function( res ) {
        console.log( "done:" );
        res.forEach( function( url ) {
            console.log( url );
        } );
    } )
    .then( undefined, function( error ) {
        console.log( "An Error occurred:" );
        console.log( error );
    } );
