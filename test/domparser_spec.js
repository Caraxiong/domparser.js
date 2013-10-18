describe('DOMParser', function() {
    var DOMParser = domparser.DOMParser;

    var ie = /Microsoft Internet Explorer/.test(navigator.appName);

    function testReadWrite(source) {
        var doc = new DOMParser().parseFromString(source);
        var serialized = new domparser.XMLSerializer().serializeToString(doc);
        expect(serialized).toEqual(source);
        testSameDOM(source);
    }

    function testSameDOM(source) {
        var ours = new DOMParser().parseFromString(source);
        var browser = new window.DOMParser().parseFromString(source, 'text/xml');

        // We only test from the room element down, not the document itself. The built-in DOMParser tends to interpret
        // the processing instructions, while we just include it in the DOM.
        // For now it's good enough if the processing instructions are just included in the output XML again (tested
        // elsewhere).
        expect(ours.documentElement).toEqualNode(browser.documentElement);
        expect(ours.xmlVersion).toEqual(browser.xmlVersion);
    }


    it('should preserve the xml processing instructions', function() {
        testReadWrite('<?xml version="1.0"?>\n<xml>Hello<test>me</test></xml>');
        testReadWrite('<?xml version="1.0" encoding="UTF-8"?>\n<xml>Hello<test>me</test></xml>');
    });

    if(!ie) {
        it('should parse the sample document', function() {
            testReadWrite('<xml>Hello, <who name="world">world</who>!<br/></xml>');
        });

        it('should preserve namespaces', function() {
            testReadWrite('<?xml version="1.0"?>\n<schema xmlns="http://www.w3.org/2001/XMLSchema" elementFormDefault="unqualified"><simpleType name="name"/></schema>');
            testReadWrite('<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="unqualified"><simpleType name="name"/></xs:schema>');
            testReadWrite('<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:example="http://example.org" elementFormDefault="unqualified"><xs:simpleType example:name="name"/></xs:schema>');
        });

        it('should preserve newlines in the document', function() {
            testReadWrite('<xml>Hel\nlo, \n<who name="world">world\n</who>\n!<br/></xml>');
        });

    } else {
        // KLUDGE: ie serializes whitespace inside elements slightly differently
        it('should parse the sample document', function() {
            testReadWrite('<xml>Hello, <who name="world">world</who>!<br /></xml>');
        });

        it('should preserve namespaces', function() {

            testReadWrite('<?xml version="1.0"?>\n<schema xmlns="http://www.w3.org/2001/XMLSchema" elementFormDefault="unqualified"><simpleType name="name" /></schema>');
            testReadWrite('<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="unqualified"><simpleType name="name" /></xs:schema>');

            // This one fails in IE (not wrong... just different):
            //             <?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="unqualified"><xs:simpleType xmlns:example="http://example.org" example:name="name" /></xs:schema>
            testSameDOM(  '<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:example="http://example.org" elementFormDefault="unqualified"><xs:simpleType example:name="name" /></xs:schema>');
        });

        it('should preserve newlines in the document', function() {
            testReadWrite('<xml>Hel\nlo, \n<who name="world">world\n</who>\n!<br /></xml>');
        });
    }

    it('should preserve entities', function() {
        testReadWrite('<xml>Hello, &lt;yes&gt;</xml>');
    });

    it('should preserve CDATA', function() {
        testReadWrite('<xml> <![CDATA[ SOME \n<DATA>\n]]> !</xml>');
    });

    it('should preserve comments', function() {
        testReadWrite('<xml><!-- a comment --></xml>');
    });


    it('should parse a text node', function() {
        var doc = new DOMParser().parseFromString('<?xml version="1.0"?>\n<test>\n<b>Some\n&lt;Text&gt;</b>\n</test>');

        var text = doc.getElementsByTagName('b')[0].firstChild;
        expect(text.textContent).toBe('Some\n<Text>');
    });

    it('should record line and column of elements', function() {
        var doc = new DOMParser().parseFromString('<?xml version="1.0"?>\n<test>\n<me><b /></me></test>');

        var elmb = doc.getElementsByTagName('b')[0];
        var elmme = doc.getElementsByTagName('me')[0];

        expect(elmme.openStart).toEqual(29);
        expect(elmme.openEnd).toEqual(33);
        expect(doc.locator.position(elmme.openStart)).toEqual({line: 2, column: 0});
        expect(doc.locator.position(elmme.openEnd)).toEqual({line: 2, column: 4});
        expect(elmme.closeStart).toEqual(38);
        expect(elmme.closeEnd).toEqual(43);

        expect(elmb.openStart).toEqual(33);
        expect(elmb.openEnd).toEqual(38);
        // Self-closing tag
        expect(elmb.closeStart).toEqual(33);
        expect(elmb.closeEnd).toEqual(38);
    });

    it('should record positions of attributes', function() {
        var doc = new DOMParser().parseFromString('<?xml version="1.0"?>\n<xml>\n<test attr="value" /></test></xml>');
        var elm = doc.getElementsByTagName('test')[0];
        var attr = elm.attributes[0];
        expect(attr.name).toBe('attr');
        expect(attr.value).toBe('value');
        var position = elm.attributePositions.attr;
        expect(position.start).toEqual(34);
        expect(position.end).toEqual(46);
        expect(position.nameEnd).toEqual(38);
        expect(position.valueStart).toEqual(39);
    });

    describe('error handling', function() {
        function errorsFor(source) {
            var doc = new DOMParser().parseFromString(source);
            return doc.errors;
        }

        it('should report an unclosed root tag', function() {
            var errors = errorsFor('<xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Unclosed root tag', line: 0, column: 5});
        });

        it('should report an unclosed comment', function() {
            var errors = errorsFor('<xml><!--</xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Unexpected end', line: 0, column: 15});
        });

        it('should report an unquoted attribute tag', function() {
            var errors = errorsFor('<xml><a attr=test /></xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Unquoted attribute value', line: 0, column: 14});
        });

        it('should report an unclosed element tag', function() {
            var errors = errorsFor('<xml><a></xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Unexpected close tag', line: 0, column: 14});
        });

        it('should report an invalid closing tag', function() {
            var errors = errorsFor('<xml><a></b></a></xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Unmatched closing tag: b', line: 0, column: 12});
            // Alternative message: Unexpected close tag
        });

        it('should report an empty closing tag', function() {
            var errors = errorsFor('<xml></></xml>');
            expect(errors.length).toBe(1);
            expect(errors[0]).toEqual({message: 'Invalid tagname in closing tag.', line: 0, column: 8});
        });

        xit('should report an invalid xml version', function() {
            // This check is not implemented yet
            var errors = errorsFor('<?xml version="notsupported"?><xml></xml>');
            expect(errors.length).toBe(1);
        });

        it('should handle an attribute without a value', function() {
            var xml = '<test t />';
            var errors = errorsFor(xml);
            expect(errors).toEqual([{message: 'Invalid attribute name', line: 0, column: 9}]);

        });
    });

});

describe('XMLSerializer', function() {

    it('should serialize built-in processing instructions', function() {
        // Test that this works with documents parsed by the native DOMParser, at least as well as the native.
        // XMLSerializer.

        // Note that the result differs between browsers, so we only test that we get the same as the browser:
        // Firefox: '<?xml version="1.0" encoding="UTF-8"?>\n<xml>Test</xml>'
        // Chrome: '<?xml version="1.0"?><xml>Test</xml>'
        // PhantomJS: '<xml>Test</xml>'

        var doc = new window.DOMParser().parseFromString('<?xml version="1.0"?>\n<xml>Test</xml>', 'text/xml');
        var serialized = new domparser.XMLSerializer().serializeToString(doc);
        var nativeSerialized = new window.XMLSerializer().serializeToString(doc);
        expect(serialized).toEqual(nativeSerialized);
    });
});

describe('Locator', function() {
    it('should report the correct locations', function() {
        var locator = new domparser.Locator('test\n1\n23');
        expect(locator.position(0)).toEqual({line: 0, column: 0});
        expect(locator.position(1)).toEqual({line: 0, column: 1});
        expect(locator.position(2)).toEqual({line: 0, column: 2});
        expect(locator.position(3)).toEqual({line: 0, column: 3});
        expect(locator.position(4)).toEqual({line: 0, column: 4});
        expect(locator.position(5)).toEqual({line: 1, column: 0});
        expect(locator.position(6)).toEqual({line: 1, column: 1});
        expect(locator.position(7)).toEqual({line: 2, column: 0});
        expect(locator.position(8)).toEqual({line: 2, column: 1});
        expect(locator.position(9)).toEqual({line: 2, column: 2});
    });

    it('should handle a single line', function() {
        var locator = new domparser.Locator('test');
        expect(locator.position(0)).toEqual({line: 0, column: 0});
        expect(locator.position(4)).toEqual({line: 0, column: 4});
    });

    it('should handle an empty string', function() {
        var locator = new domparser.Locator('');
        expect(locator.position(0)).toEqual({line: 0, column: 0});
    });

    it('should gracefully handle out-of-bound positions', function() {
        var locator = new domparser.Locator('test\nmore');
        expect(locator.position(-1)).toEqual({line: 0, column: 0});
        expect(locator.position(50)).toEqual({line: 2, column: 0});
    });

    it('should handle consecutive newlines', function() {
        var locator = new domparser.Locator('\n\n\n\n');
        expect(locator.position(0)).toEqual({line: 0, column: 0});
        expect(locator.position(1)).toEqual({line: 1, column: 0});
        expect(locator.position(2)).toEqual({line: 2, column: 0});
        expect(locator.position(3)).toEqual({line: 3, column: 0});
        expect(locator.position(4)).toEqual({line: 4, column: 0});
    });
});
