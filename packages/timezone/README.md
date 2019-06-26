# js-joda-timezone

[![npm version](https://badge.fury.io/js/js-joda-timezone.svg)](https://badge.fury.io/js/js-joda-timezone)
[![Build Status](https://travis-ci.org/js-joda/js-joda-timezone.svg)](https://travis-ci.org/js-joda/js-joda-timezone)
[![Sauce Test Status](https://saucelabs.com/buildstatus/js-joda-timezone)](https://saucelabs.com/u/js-joda-timezone)
[![Coverage Status](https://coveralls.io/repos/js-joda/js-joda-timezone/badge.svg?branch=master&service=github)](https://coveralls.io/github/js-joda/js-joda-timezone?branch=master)
[![Tested node version](https://img.shields.io/badge/tested_with-current_node_LTS-blue.svg?style=flat)]()

[![Sauce Test Status](https://saucelabs.com/browser-matrix/js-joda-timezone.svg)](https://saucelabs.com/u/js-joda-timezone)

## Motivation

Implementation of the js-joda ZoneRulesProvider, providing the 
bindings to the iana tzdb, using latest zone file generated by moment-timezone

## Usage

### Node

Install joda using npm

    npm install js-joda
    npm install js-joda-timezone

### es5

    var jsJoda = require('js-joda')
    require('js-joda-timezone')
    
    var { LocalDateTime, ZoneId, ZonedDateTime } = jsJoda;
         
    LocalDateTime
        .parse('2016-06-30T11:30')
        .atZone(ZoneId.of('Europe/Berlin'))
        .toString()  // 2016-06-30T11:30+02:00[Europe/Berlin]
         
    ZonedDateTime
        .parse('2016-06-30T11:30+02:00[Europe/Berlin]') 
        .withZoneSameInstant(ZoneId.of('America/New_York'))
        .toString() // 2016-06-30T05:30-04:00[America/New_York]

    ZonedDateTime
        .parse('2016-06-30T11:30+02:00[Europe/Berlin]')
        .withZoneSameLocal(ZoneId.of('America/New_York'))
        .toString() // 2016-06-30T11:30-04:00[America/New_York]

### es6 / typescript

    import { ZonedDateTime, ZoneId } from 'js-joda'
    import 'js-joda-timezone'
    
    const zdt = ZonedDateTime.now(ZoneId.of('America/New_York'))

### Browser

    <script src="../dist/js-joda.js"></script>
    <script src="../dist/js-joda-timezone.js"></script>
    <script>
        // copy all js-joda classes to the global scope
        for(let key in JSJoda) { this[key] = JSJoda[key]; }
            
        LocalDateTime
            .parse('2016-06-30T11:30')
            .atZone(ZoneId.of('Europe/Berlin'))
            .toString()  // 2016-06-30T11:30+02:00[Europe/Berlin]
             
        ZonedDateTime
            .parse('2016-06-30T11:30+02:00[Europe/Berlin]') 
            .withZoneSameInstant(ZoneId.of('America/New_York'))
            .toString() // 2016-06-30T05:30-04:00[America/New_York]
    
        ZonedDateTime
            .parse('2016-06-30T11:30+02:00[Europe/Berlin]')
            .withZoneSameLocal(ZoneId.of('America/New_York'))
            .toString() // 2016-06-30T11:30-04:00[America/New_York]
    </script>

## Reducing js-joda-timezone file size
If you don't need all the historical data that js-joda-timezone provides, you can instead use one of the reduced files ize builds:

* `js-joda-timezone-10-year-range.js` covers +- five years from the current version's release
* `js-joda-timezone-1970-2030.js` covers from 1970 to 2030
* `js-joda-timezone-2012-2022.js` covers from 2012 to 2022

To use one of these, just change your import path to the following format:

    import 'js-joda-timezone/dist/js-joda-timezone-1970-2030'

## Implementation details

* This ZoneRulesProvider implemantion supplies all functionality that is required by the js-joda package. 
* Additional [ZoneRules](https://js-joda.github.io/js-joda/esdoc/class/src/zone/ZoneRules.js~ZoneRules.html) functionality like [transitions(), etc.](https://github.com/js-joda/js-joda-timezone/blob/5288c41433133c248f66c271be59878356db9ea8/test/MomentZoneRulesTest.js#L310-L322) is not implemented.

## License

* js-joda-timezone is released under the [BSD 3-clause license](LICENSE):

* The author of joda time and the lead architect of the JSR-310 is Stephen Colebourne.

* The json versions of the iana tzdb are imported from and generated with [moment-timezone](https://github.com/moment/moment-timezone).   

