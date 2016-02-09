/**
 * @copyright (c) 2016, Philipp Thuerwaechter & Pattrick Hueper
 * @copyright (c) 2007-present, Stephen Colebourne & Michael Nascimento Santos
 * @license BSD-3-Clause (see LICENSE in the root directory of this source tree)
 */

import {assert} from '../assert';
import {ArithmeticException, DateTimeException, IllegalArgumentException} from '../errors';

import {Enum} from '../Enum';

import {DateTimeFormatter} from './DateTimeFormatter';
import {DecimalStyle} from './DecimalStyle';
import {SignStyle} from './SignStyle';
import {ResolverStyle} from './ResolverStyle';

const MAX_WIDTH = 15; // can't parse all numbers with more then 15 digits in javascript

export class DateTimeFormatterBuilder {

    constructor(){
        /**
         * The currently active builder, used by the outermost builder.
         */
        this._active = this;
        /**
         * The parent builder, null for the outermost builder.
         */
        this._parent = null;

        /**
         * The list of printers that will be used.
         */
        this._printerParsers = [];

        /**
         * Whether this builder produces an optional formatter.
         */
        this._optional = false;
        /**
         * The width to pad the next field to.
         */
        this._padNextWidth = 0;

        /**
         * The character to pad the next field with.
         */
        this._padNextChar = null;

        /**
         * The index of the last variable width value parser.
         */
        this._valueParserIndex = -1;
    }

    /**
     * Changes the parse style to be case sensitive for the remainder of the formatter.
     * 
     * Parsing can be case sensitive or insensitive - by default it is case sensitive.
     * This method allows the case sensitivity setting of parsing to be changed.
     * 
     * Calling this method changes the state of the builder such that all
     * subsequent builder method calls will parse text in case sensitive mode.
     * See {@link #parseCaseInsensitive} for the opposite setting.
     * The parse case sensitive/insensitive methods may be called at any point
     * in the builder, thus the parser can swap between case parsing modes
     * multiple times during the parse.
     * 
     * Since the default is case sensitive, this method should only be used after
     * a previous call to {@code #parseCaseInsensitive}.
     *
     * @return this, for chaining, not null
     */
    parseCaseSensitive() {
        this._appendInternalPrinterParser(SettingsParser.SENSITIVE);
        return this;
    }

    /**
     * Changes the parse style to be case insensitive for the remainder of the formatter.
     * 
     * Parsing can be case sensitive or insensitive - by default it is case sensitive.
     * This method allows the case sensitivity setting of parsing to be changed.
     * 
     * Calling this method changes the state of the builder such that all
     * subsequent builder method calls will parse text in case sensitive mode.
     * See {@link #parseCaseSensitive()} for the opposite setting.
     * The parse case sensitive/insensitive methods may be called at any point
     * in the builder, thus the parser can swap between case parsing modes
     * multiple times during the parse.
     *
     * @return this, for chaining, not null
     */
    parseCaseInsensitive() {
        this._appendInternalPrinterParser(SettingsParser.INSENSITIVE);
        return this;
    }

    //-----------------------------------------------------------------------
    /**
     * Changes the parse style to be strict for the remainder of the formatter.
     * 
     * Parsing can be strict or lenient - by default its strict.
     * This controls the degree of flexibility in matching the text and sign styles.
     * 
     * When used, this method changes the parsing to be strict from this point onwards.
     * As strict is the default, this is normally only needed after calling {@link #parseLenient()}.
     * The change will remain in force until the end of the formatter that is eventually
     * constructed or until {@code parseLenient} is called.
     *
     * @return this, for chaining, not null
     */
    parseStrict() {
        this._appendInternalPrinterParser(SettingsParser.STRICT);
        return this;
    }

    /**
     * Changes the parse style to be lenient for the remainder of the formatter.
     * Note that case sensitivity is set separately to this method.
     * 
     * Parsing can be strict or lenient - by default its strict.
     * This controls the degree of flexibility in matching the text and sign styles.
     * Applications calling this method should typically also call {@link #parseCaseInsensitive()}.
     * 
     * When used, this method changes the parsing to be strict from this point onwards.
     * The change will remain in force until the end of the formatter that is eventually
     * constructed or until {@code parseStrict} is called.
     *
     * @return this, for chaining, not null
     */
    parseLenient() {
        this._appendInternalPrinterParser(SettingsParser.LENIENT);
        return this;
    }

    /**
     * appendValue function overloading
     */
    appendValue(){
        if(arguments.length === 1){
            return this._appendValue1.apply(this, arguments);
        } else if(arguments.length === 2){
            return this._appendValue2.apply(this, arguments);
        } else {
            return this._appendValue4.apply(this, arguments);
        }  
    }
    
    /**
     * Appends the value of a date-time field to the formatter using a normal
     * output style.
     * 
     * The value of the field will be output during a print.
     * If the value cannot be obtained then an exception will be thrown.
     * 
     * The value will be printed as per the normal print of an integer value.
     * Only negative numbers will be signed. No padding will be added.
     * 
     * The parser for a variable width value such as this normally behaves greedily,
     * requiring one digit, but accepting as many digits as possible.
     * This behavior can be affected by 'adjacent value parsing'.
     * See {@link #appendValue(TemporalField, int)} for full details.
     *
     * @param field  the field to append, not null
     * @return this, for chaining, not null
     */
    _appendValue1(field) {
        assert(field != null);
        this._appendValuePrinterParser(new NumberPrinterParser(field, 1, MAX_WIDTH, SignStyle.NORMAL));
        return this;
    }

    /**
     * Appends the value of a date-time field to the formatter using a fixed
     * width, zero-padded approach.
     * 
     * The value of the field will be output during a print.
     * If the value cannot be obtained then an exception will be thrown.
     * 
     * The value will be zero-padded on the left. If the size of the value
     * means that it cannot be printed within the width then an exception is thrown.
     * If the value of the field is negative then an exception is thrown during printing.
     * 
     * This method supports a special technique of parsing known as 'adjacent value parsing'.
     * This technique solves the problem where a variable length value is followed by one or more
     * fixed length values. The standard parser is greedy, and thus it would normally
     * steal the digits that are needed by the fixed width value parsers that follow the
     * variable width one.
     * 
     * No action is required to initiate 'adjacent value parsing'.
     * When a call to {@code appendValue} with a variable width is made, the builder
     * enters adjacent value parsing setup mode. If the immediately subsequent method
     * call or calls on the same builder are to this method, then the parser will reserve
     * space so that the fixed width values can be parsed.
     * 
     * For example, consider {@code builder.appendValue(YEAR).appendValue(MONTH_OF_YEAR, 2);}
     * The year is a variable width parse of between 1 and 19 digits.
     * The month is a fixed width parse of 2 digits.
     * Because these were appended to the same builder immediately after one another,
     * the year parser will reserve two digits for the month to parse.
     * Thus, the text '201106' will correctly parse to a year of 2011 and a month of 6.
     * Without adjacent value parsing, the year would greedily parse all six digits and leave
     * nothing for the month.
     * 
     * Adjacent value parsing applies to each set of fixed width not-negative values in the parser
     * that immediately follow any kind of variable width value.
     * Calling any other append method will end the setup of adjacent value parsing.
     * Thus, in the unlikely event that you need to avoid adjacent value parsing behavior,
     * simply add the {@code appendValue} to another {@code DateTimeFormatterBuilder}
     * and add that to this builder.
     * 
     * If adjacent parsing is active, then parsing must match exactly the specified
     * number of digits in both strict and lenient modes.
     * In addition, no positive or negative sign is permitted.
     *
     * @param field  the field to append, not null
     * @param width  the width of the printed field, from 1 to 19
     * @return this, for chaining, not null
     * @throws IllegalArgumentException if the width is invalid
     */
    _appendValue2(field, width) {
        assert(field != null);
        if (width < 1 || width > MAX_WIDTH) {
            throw new IllegalArgumentException(`The width must be from 1 to ${MAX_WIDTH} inclusive but was ${width}`);
        }
        var pp = new NumberPrinterParser(field, width, width, SignStyle.NOT_NEGATIVE);
        this._appendValuePrinterParser(pp);
        return this;
    }

    /**
     * Appends the value of a date-time field to the formatter providing full
     * control over printing.
     * 
     * The value of the field will be output during a print.
     * If the value cannot be obtained then an exception will be thrown.
     * 
     * This method provides full control of the numeric formatting, including
     * zero-padding and the positive/negative sign.
     * 
     * The parser for a variable width value such as this normally behaves greedily,
     * accepting as many digits as possible.
     * This behavior can be affected by 'adjacent value parsing'.
     * See {@link #appendValue(TemporalField, int)} for full details.
     * 
     * In strict parsing mode, the minimum number of parsed digits is {@code minWidth}.
     * In lenient parsing mode, the minimum number of parsed digits is one.
     * 
     * If this method is invoked with equal minimum and maximum widths and a sign style of
     * {@code NOT_NEGATIVE} then it delegates to {@code appendValue(TemporalField,int)}.
     * In this scenario, the printing and parsing behavior described there occur.
     *
     * @param field  the field to append, not null
     * @param minWidth  the minimum field width of the printed field, from 1 to 19
     * @param maxWidth  the maximum field width of the printed field, from 1 to 19
     * @param signStyle  the positive/negative output style, not null
     * @return this, for chaining, not null
     * @throws IllegalArgumentException if the widths are invalid
     */
    _appendValue4(field, minWidth, maxWidth, signStyle) {
        assert(field != null);
        if (minWidth === maxWidth && signStyle === SignStyle.NOT_NEGATIVE) {
            return this._appendValue2(field, maxWidth);
        }
        if (minWidth < 1 || minWidth > MAX_WIDTH) {
            throw new IllegalArgumentException(`The minimum width must be from 1 to ${MAX_WIDTH} inclusive but was ${minWidth}`);
        }
        if (maxWidth < 1 || maxWidth > MAX_WIDTH) {
            throw new IllegalArgumentException(`The minimum width must be from 1 to ${MAX_WIDTH} inclusive but was ${maxWidth}`);
        }
        if (maxWidth < minWidth) {
            throw new IllegalArgumentException(`The maximum width must exceed or equal the minimum width but ${maxWidth} < ${minWidth}`);
        }
        var pp = new NumberPrinterParser(field, minWidth, maxWidth, signStyle);
        this._appendValuePrinterParser(pp);
        return this;
    }

    /**
     * Appends a fixed width printer-parser.
     *
     * @param width  the width
     * @param pp  the printer-parser, not null
     * @return this, for chaining, not null
     */
    _appendValuePrinterParser(pp) {
        assert(pp != null);
        if (this._active._valueParserIndex >= 0 &&
                this._active._printerParsers[this._active._valueParserIndex] instanceof NumberPrinterParser) {
            var activeValueParser = this._active._valueParserIndex;

            // adjacent parsing mode, update setting in previous parsers
            var basePP = this._active._printerParsers[activeValueParser];
            if (pp.minWidth() === pp.maxWidth() && pp.signStyle() === SignStyle.NOT_NEGATIVE) {
                // Append the width to the subsequentWidth of the active parser
                basePP = basePP.withSubsequentWidth(pp.maxWidth());
                // Append the new parser as a fixed width
                this._appendInternal(pp.withFixedWidth());
                // Retain the previous active parser
                this._active._valueParserIndex = activeValueParser;
            } else {
                // Modify the active parser to be fixed width
                basePP = basePP.withFixedWidth();
                // The new parser becomes the mew active parser
                this._active._valueParserIndex = this._appendInternal(pp);
            }
            // Replace the modified parser with the updated one
            this._active._printerParsers[activeValueParser] = basePP;
        } else {
            // The new Parser becomes the active parser
            this._active._valueParserIndex = this._appendInternal(pp);
        }
        return this;
    }

    /**
     * Appends a printer and/or parser to the internal list handling padding.
     *
     * @param pp  the printer-parser to add, not null
     * @return the index into the active parsers list
     */
    _appendInternal(pp) {
        assert(pp != null);
        if (this._active._padNextWidth > 0) {
            if (pp != null) {
                pp = new PadPrinterParserDecorator(pp, this._active._padNextWidth, this._active._padNextChar);
            }
            this._active._padNextWidth = 0;
            this._active._padNextChar = 0;
        }
        this._active._printerParsers.push(pp);
        this._active._valueParserIndex = -1;
        return this._active._printerParsers.length - 1;
    }

    /**
     * Appends a string literal to the formatter.
     * 
     * This string will be output during a print.
     * 
     * If the literal is empty, nothing is added to the formatter.
     *
     * @param literal  the literal to append, not null
     * @return this, for chaining, not null
     */
    appendLiteral(literal) {
        assert(literal != null);
        this._appendInternalPrinterParser(new StringLiteralPrinterParser(literal));
        return this;
    }
    
    /**
     * Appends a printer and/or parser to the internal list handling padding.
     *
     * @param pp  the printer-parser to add, not null
     * @return the index into the active parsers list
     */
    _appendInternalPrinterParser(pp) {
        assert(pp != null);
        if (this._active._padNextWidth > 0) {
            if (pp != null) {
                pp = new PadPrinterParserDecorator(pp, this._active._padNextWidth, this._active._padNextChar);
            }
            this._active._padNextWidth = 0;
            this._active._padNextChar = 0;
        }
        this._active._printerParsers.push(pp);
        this._active._valueParserIndex = -1;
        return this._active._printerParsers.length - 1;
    }
    
    /**
     * Completes this builder by creating the DateTimeFormatter.
     * 
     * This will create a formatter with the specified locale.
     * Numbers will be printed and parsed using the standard non-localized set of symbols.
     * 
     * Calling this method will end any open optional sections by repeatedly
     * calling {@link #optionalEnd()} before creating the formatter.
     * 
     * This builder can still be used after creating the formatter if desired,
     * although the state may have been changed by calls to {@code optionalEnd}.
     *
     * @param resolverStyle  the new resolver style
     * @return the created formatter, not null
     */
    toFormatter(resolverStyle=ResolverStyle.SMART) {
        while (this._active._parent != null) {
            this.optionalEnd();
        }
        var pp = new CompositePrinterParser(this._printerParsers, false);
        return new DateTimeFormatter(pp, null, DecimalStyle.STANDARD, resolverStyle, null, null, null);
    }

}

const EXCEED_POINTS = [
    0,
    10,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    100000000,
    1000000000
];

class CompositePrinterParser {

    constructor(printerParsers, optional) {
        this._printerParsers = printerParsers;
        this._optional = optional;
    }

    /**
     * Returns a copy of this printer-parser with the optional flag changed.
     *
     * @param optional  the optional flag to set in the copy
     * @return the new printer-parser, not null
     */
    withOptional(optional) {
        if (optional === this._optional) {
            return this;
        }
        return new CompositePrinterParser(this._printerParsers, optional);
    }

    print(context, buf) {
        var length = buf.length();
        if (this._optional) {
            context.startOptional();
        }
        try {
            for (let i=0; i<this._printerParsers.length; i++) {
                let pp = this._printerParsers[i];
                if (pp.print(context, buf) == false) {
                    buf.setLength(length);  // reset buffer
                    return true;
                }
            }
        } finally {
            if (this._optional) {
                context.endOptional();
            }
        }
        return true;
    }

    parse(context, text, position) {
        if (this._optional) {
            context.startOptional();
            var pos = position;
            for (let i=0; i<this._printerParsers.length; i++) {
                let pp = this._printerParsers[i];
                pos = pp.parse(context, text, pos);
                if (pos < 0) {
                    context.endOptional(false);
                    return position;  // return original position
                }
            }
            context.endOptional(true);
            return pos;
        } else {
            for (let i=0; i<this._printerParsers.length; i++) {
                let pp = this._printerParsers[i];
                position = pp.parse(context, text, position);
                if (position < 0) {
                    break;
                }
            }
            return position;
        }
    }

    toString() {
        var buf = '';
        if (this._printerParsers != null) {
            buf += this._optional ? '[' : '(';
            for (let i=0; i<this._printerParsers.length; i++) {
                let pp = this._printerParsers[i];
                buf += pp.toString();
            }
            buf += this._optional ? ']' : ')';
        }
        return buf;
    }
}

class SettingsParser extends Enum {

    print(context, buf) {
        return true;  // nothing to do here
    }

    parse(context, text, position) {
        // using ordinals to avoid javac synthetic inner class
        switch (this) {
            case SettingsParser.SENSITIVE:   context.setCaseSensitive(true); break;
            case SettingsParser.INSENSITIVE: context.setCaseSensitive(false); break;
            case SettingsParser.STRICT:      context.setStrict(true); break;
            case SettingsParser.LENIENT:     context.setStrict(false); break;
        }
        return position;
    }

    toString() {
        // using ordinals to avoid javac synthetic inner class
        switch (this) {
            case SettingsParser.SENSITIVE:   return 'ParseCaseSensitive(true)';
            case SettingsParser.INSENSITIVE: return 'ParseCaseSensitive(false)';
            case SettingsParser.STRICT:      return 'ParseStrict(true)';
            case SettingsParser.LENIENT:     return 'ParseStrict(false)';
        }
    }
}
SettingsParser.SENSITIVE = new SettingsParser('SENSITIVE');
SettingsParser.INSENSITIVE = new SettingsParser('INSENSITIVE');
SettingsParser.STRICT = new SettingsParser('STRICT');
SettingsParser.LENIENT = new SettingsParser('LENIENT');


class NumberPrinterParser {

    /**
     * Constructor.
     *
     * @param field  the field to print, not null
     * @param minWidth  the minimum field width, from 1 to 19
     * @param maxWidth  the maximum field width, from minWidth to 19
     * @param signStyle  the positive/negative sign style, not null
     * @param subsequentWidth  the width of subsequent non-negative numbers, 0 or greater,
     *  -1 if fixed width due to active adjacent parsing
     */
    constructor(field, minWidth, maxWidth, signStyle, subsequentWidth=0){
        this._field = field;
        this._minWidth = minWidth;
        this._maxWidth = maxWidth;
        this._signStyle = signStyle;
        this._subsequentWidth = subsequentWidth;
    }

    field(){ return this._field;}
    minWidth(){ return this._minWidth;}
    maxWidth(){ return this._maxWidth;}
    signStyle(){ return this._signStyle;}

    withSubsequentWidth(subsequentWidth) {
        return new NumberPrinterParser(this._field, this._minWidth, this._maxWidth, this._signStyle, this._subsequentWidth + subsequentWidth);
    }

    _isFixedWidth() {
        return this._subsequentWidth === -1 ||
                (this._subsequentWidth > 0 && this._minWidth === this._maxWidth && this._signStyle === SignStyle.NOT_NEGATIVE);
    }

    print(context, buf) {
        var value = context.getValue(this._field);
        if (value == null) {
            return false;
        }
        var symbols = context.symbols();
        var str = '' + Math.abs(value);
        if (str.length > this._maxWidth) {
            throw new DateTimeException('Field ' + this._field +
                ' cannot be printed as the value ' + value +
                ' exceeds the maximum print width of ' + this._maxWidth);
        }
        str = symbols.convertNumberToI18N(str);

        if (value >= 0) {
            switch (this._signStyle) {
                case SignStyle.EXCEEDS_PAD:
                    if (this._minWidth < MAX_WIDTH && value >= EXCEED_POINTS[this._minWidth]) {
                        buf.append(symbols.positiveSign());
                    }
                    break;
                case SignStyle.ALWAYS:
                    buf.append(symbols.positiveSign());
                    break;
            }
        } else {
            switch (this._signStyle) {
                case SignStyle.NORMAL:
                case SignStyle.EXCEEDS_PAD:
                case SignStyle.ALWAYS:
                    buf.append(symbols.negativeSign());
                    break;
                case SignStyle.NOT_NEGATIVE:
                    throw new DateTimeException('Field ' + this._field +
                        ' cannot be printed as the value ' + value +
                        ' cannot be negative according to the SignStyle');
            }
        }
        for (let i = 0; i < this._minWidth - str.length; i++) {
            buf.append(symbols.zeroDigit());
        }
        buf.append(str);
        return true;
    }

    parse(context, text, position){
        var length = text.length;
        if (position === length) {
            return ~position;
        }
        assert(position>=0 && position<length);
        var sign = text.charAt(position);  // IOOBE if invalid position
        var negative = false;
        var positive = false;
        if (sign === context.symbols().positiveSign()) {
            if (this._signStyle.parse(true, context.isStrict(), this._minWidth === this._maxWidth) === false) {
                return ~position;
            }
            positive = true;
            position++;
        } else if (sign === context.symbols().negativeSign()) {
            if (this._signStyle.parse(false, context.isStrict(), this._minWidth === this._maxWidth) === false) {
                return ~position;
            }
            negative = true;
            position++;
        } else {
            if (this._signStyle === SignStyle.ALWAYS && context.isStrict()) {
                return ~position;
            }
        }
        var effMinWidth = (context.isStrict() || this._isFixedWidth() ? this._minWidth : 1);
        var minEndPos = position + effMinWidth;
        if (minEndPos > length) {
            return ~position;
        }
        var effMaxWidth = (context.isStrict() || this._isFixedWidth() ? this._maxWidth : 9) + Math.max(this._subsequentWidth, 0);
        var total = 0;
        var pos = position;
        for (let pass = 0; pass < 2; pass++) {
            let maxEndPos = Math.min(pos + effMaxWidth, length);
            while (pos < maxEndPos) {
                let ch = text.charAt(pos++);
                let digit = context.symbols().convertToDigit(ch);
                if (digit < 0) {
                    pos--;
                    if (pos < minEndPos) {
                        return ~position;  // need at least min width digits
                    }
                    break;
                }
                if ((pos - position) > MAX_WIDTH) {
                    throw new ArithmeticException('number text exceeds length');
                } else {
                    total = total * 10 + digit;
                }
            }
            if (this._subsequentWidth > 0 && pass === 0) {
                // re-parse now we know the correct width
                let parseLen = pos - position;
                effMaxWidth = Math.max(effMinWidth, parseLen - this._subsequentWidth);
                pos = position;
                total = 0;
            } else {
                break;
            }
        }
        if (negative) {
            if (total === 0 && context.isStrict()) {
                return ~(position - 1);  // minus zero not allowed
            }
            if(total !== 0) {
                total = -total;
            }
        } else if (this._signStyle === SignStyle.EXCEEDS_PAD && context.isStrict()) {
            let parseLen = pos - position;
            if (positive) {
                if (parseLen <= this._minWidth) {
                    return ~(position - 1);  // '+' only parsed if minWidth exceeded
                }
            } else {
                if (parseLen > this._minWidth) {
                    return ~position;  // '+' must be parsed if minWidth exceeded
                }
            }
        }
        return this._setValue(context, total, position, pos);
    }
    
    /**
     * Stores the value.
     *
     * @param context  the context to store into, not null
     * @param value  the value
     * @param errorPos  the position of the field being parsed
     * @param successPos  the position after the field being parsed
     * @return the new position
     */
    _setValue(context, value, errorPos, successPos) {
        return context.setParsedField(this._field, value, errorPos, successPos);
    }
 
    toString() {
        if (this._minWidth === 1 && this._maxWidth === MAX_WIDTH && this._signStyle === SignStyle.NORMAL) {
            return 'Value(' + this._field + ')';
        }
        if (this._minWidth === this._maxWidth && this._signStyle === SignStyle.NOT_NEGATIVE) {
            return 'Value(' + this._field + ',' + this._minWidth + ')';
        }
        return 'Value(' + this._field + ',' + this._minWidth + ',' + this._maxWidth + ',' + this._signStyle + ')';
    }
    
}

/**
 * Pads the output to a fixed width.
 */
class PadPrinterParserDecorator {

    /**
     * Constructor.
     *
     * @param printerParser  the printer, not null
     * @param padWidth  the width to pad to, 1 or greater
     * @param padChar  the pad character
     */
    constructor(printerParser, padWidth, padChar) {
        // input checked by DateTimeFormatterBuilder
        this._printerParser = printerParser;
        this._padWidth = padWidth;
        this._padChar = padChar;
    }

    print(context, buf) {
        var preLen = buf.length();
        if (this._printerParser.print(context, buf) === false) {
            return false;
        }
        var len = buf.length() - preLen;
        if (len > this._padWidth) {
            throw new DateTimeException(
                `Cannot print as output of ${len} characters exceeds pad width of ${this._padWidth}`);
        }
        for (let i = 0; i < this._padWidth - len; i++) {
            buf.insert(preLen, this._padChar);
        }
        return true;
    }

    parse(context, text, position) {
        // cache context before changed by decorated parser
        var strict = context.isStrict();
        var caseSensitive = context.isCaseSensitive();
        // parse
        assert(!(position > text.length));
        if (position === text.length) {
            return ~position;  // no more characters in the string
        }
        var endPos = position + this._padWidth;
        if (endPos > text.length) {
            if (strict) {
                return ~position;  // not enough characters in the string to meet the parse width
            }
            endPos = text.length;
        }
        var pos = position;
        while (pos < endPos &&
                (caseSensitive ? text[pos] === this._padChar : context.charEquals(text[pos], this._padChar))) {
            pos++;
        }
        text = text.substring(0, endPos);
        var resultPos = this._printerParser.parse(context, text, pos);
        if (resultPos !== endPos && strict) {
            return ~(position + pos);  // parse of decorated field didn't parse to the end
        }
        return resultPos;
    }

    toString() {
        return `Pad(${this._printerParser},${this._padWidth}${(this._padChar === ' ' ? ')' : ',\'' + this._padChar + '\')')}`;
    }
}

/**
* Prints or parses a string literal.
*/
class StringLiteralPrinterParser {

        constructor(literal) {
            this._literal = literal;
        }

        print(context, buf) {
            buf.append(this._literal);
            return true;
        }

        parse(context, text, position) {
            var length = text.length;
            assert(!(position > length || position < 0));

            if (context.subSequenceEquals(text, position, this._literal, 0, this._literal.length) === false) {
                return ~position;
            }
            return position + this._literal.length;
        }

        toString() {
            return '\'' + this._literal + '\'';
        }
    }

class StringBuilder {
    constructor(){
        this._str = '';
    }

    append(str){
        this._str += str;
    }

    insert(offset, str){
        this._str = this._str.slice(0, offset) + str + this._str.slice(offset);
    }

    length(){
        return this._str.length;
    }

    setLength(length){
        this._str = this._str.slice(0, length);
    }


    toString() {
        return this._str;
    }
}

DateTimeFormatterBuilder.CompositePrinterParser = CompositePrinterParser;
DateTimeFormatterBuilder.SettingsParser = SettingsParser;
DateTimeFormatterBuilder.NumberPrinterParser = NumberPrinterParser;
DateTimeFormatterBuilder.StringLiteralPrinterParser = StringLiteralPrinterParser;
DateTimeFormatterBuilder.CharLiteralPrinterParser = StringLiteralPrinterParser;
DateTimeFormatterBuilder.PadPrinterParserDecorator = PadPrinterParserDecorator;
DateTimeFormatterBuilder.StringBuilder = StringBuilder;