/**
 * Date: 06.01.15
 * Time: 17:23
 */
"use strict";

var crawler = require("./index.js");

crawler( "www.pluspol-interactive.de" )
    .then( function( res ) {
        console.log( "Response:", res );
    }, function( error ) {
        console.log( "Error:", error );
    } );