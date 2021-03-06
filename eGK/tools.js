//
// Tools for eGK
//

//
// Context menu on eGK node
//
function OutlineCardActionListener(node, action) {
	switch(action) {
	case "Verify PIN.CH":
		var card = node.userObject.card;
		var mf = new CardFile(card, "#D2760001448000");

		print("Please enter PIN.CH for HIC");
		ok = mf.performCHV(true, 1);
		if (ok) {
			print("PIN verification successful");
		} else {
			print("PIN verification failed");
		}
		break;
	case "Verify PIN.home":
		var card = node.userObject.card;
		var mf = new CardFile(card, "#D2760001448000");

		print("Please enter PIN.home for HIC");
		ok = mf.performCHV(true, 2);
		if (ok) {
			print("PIN verification successful");
		} else {
			print("PIN verification failed");
		}
		break;
	}
}



//
// Add XML document model to outline view
//
function xmltree(obj, parent) {

	for (i in obj) {
		if (typeof(obj[i]) == "object") {
			if (obj[i].elementValue) {
				var n = new OutlineNode(i + " : " + obj[i].elementValue);
				parent.insert(n);
			} else {
				var n = new OutlineNode(i);
				parent.insert(n);
				xmltree(obj[i], n);
			}
		} else {
			var n = new OutlineNode(i + " : " + obj[i]);
			parent.insert(n);
		}
	}
}



//
// Dump content of zipped ByteString
//
function zipdump(zipbs) {
	var bais = new java.io.ByteArrayInputStream(zipbs);
	var zip = new java.util.zip.GZIPInputStream(bais);

	var fc = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 10000);
	var len = zip.read(fc, 0, 10000);

//	print("Read from zip = " + len);
//	print(fc);
	var bb = new ByteBuffer(fc);
	var bs = bb.toByteString().left(len);
	print(bs.toString(UTF8));
}



//
// New class overwriting DataOutline from CardOutlineFactory
//
function eGKDataOutline(factory, data, format) {
	DataOutline.call(this, factory, data, format);
}

eGKDataOutline.prototype = new DataOutline();
eGKDataOutline.constructor = eGKDataOutline;


//
// Use our own decorator for special zipped XML files
//
eGKDataOutline.prototype.decorate = function(format) {

	var view = this.view;
	var data = this.data;

	if (!format) {
		return;
	}

	if (((format.substr(0, 4) == "asn1") || (format.substr(0, 7) == "tlvlist")) && (data.length >= 2)) {
                var total = data.length;

                while(total >= 2) {
                	try	{
	                        var asn = new ASN1(data);
	                }
	                catch(e) {
	                	print("Error in TLV structure: " + e);
	                	return;
	                }

                        this.asn = asn;
                        this.asn1DecoratorHook(format);
                        view.insert(asn);
                        total -= asn.size;

                        if (format.substr(0, 4) == "asn") {
                                break;
                        }

                        data = data.bytes(asn.size);
                        if ((data.length == 0) || (data.byteAt(0) == 0x00) || (data.byteAt(0) == 0xFF)) {
                                break;
                        }
                }

                if (total > 0) {
                        var sparecontent = new OutlineNode(total + " spare bytes");
                        view.insert(sparecontent);
                }
        } else if (format.substr(0, 3) == "xml") {
		if (format.substr(4, 3) == "vd1") {
			if (data.length < 8) {
				print("Invalid header in EF.VD");
				return;
			}
			var osvd = data.bytes(0, 2).toUnsigned();
			var oevd = data.bytes(2, 2).toUnsigned();
			var osgvd = data.bytes(4, 2).toUnsigned();
			var oegvd = data.bytes(6, 2).toUnsigned();

			print("Offsets = " + osvd + " " + oevd + " " + osgvd + " " + oegvd);

			if (osvd != 0xFFFF) {
				if (oevd == 0x1F8B) {	// New in 1.2.1
					var subs = data.bytes(2, len);
					zipdump(subs);
					var x = GPXML.parse(subs);
					xmltree(x, this.view);
				} else {
					if ((osvd > data.length) || (oevd > data.length)) {
						print("First two offsets out of range");
						return;
					}
					var subs = data.bytes(osvd, oevd - osvd + 1);
					if (subs.left(2).toString(HEX) != "1F8B") {
						print("Invalid zip header");
					}
					zipdump(subs);
					var x = GPXML.parse(subs);
					xmltree(x, this.view);
				}
			}
			if (osgvd != 0xFFFF) {
				if ((osgvd > data.length) || (oegvd > data.length)) {
					print("Second two offsets out of range");
					return;
				}
				var subs = data.bytes(osgvd, oegvd - osgvd + 1);
				if (subs.left(2).toString(HEX) != "1F8B") {
					print("Invalid zip header");
				}
				zipdump(subs);
				var x = GPXML.parse(subs);
				xmltree(x, this.view);
			}

		} else {
			if (data.length < 2) {
				print("Invalid header in EF.PD or EF.GVD");
				return;
			}
			var len = data.bytes(0, 2).toUnsigned();

			if (len > data.length) {
				print("Length field out of range");
				return;
			}

			var subs = data.bytes(2, len);
			if (subs.left(2).toString(HEX) != "1F8B") {
				print("Invalid zip header");
			}
			zipdump(subs);
			var x = GPXML.parse(subs);
			xmltree(x, this.view);
		}
	} else if (format.substr(0, 8) == "statusvd") {
		var tpending = (data.byteAt(0) != 0x30);

		var n = new OutlineNode((tpending ? "" : "No ") + "Transaction pending");
		view.insert(n);

		var tstamp = data.bytes(1, 4).toString(ASCII) + "-" + data.bytes(5, 2).toString(ASCII) + "-" + data.bytes(7, 2).toString(ASCII) + " " +
			     data.bytes(9, 2).toString(ASCII) + ":" + data.bytes(11, 2).toString(ASCII) + ":" + data.bytes(13, 2).toString(ASCII);

		var n = new OutlineNode("Data from : " + tstamp);
		view.insert(n);

		var version = data.bytes(15, 5).toString(HEX);

		var n = new OutlineNode("XML Version : " + version);
		view.insert(n);

		var version = data.bytes(20, 5).toString(HEX);

		var n = new OutlineNode("Obj Version : " + version);
		view.insert(n);
	}
}



//
// Create a derived class from CardOutlineFactory to customize the OutlineDataObject class
//
function eGKCardOutlineFactory() {
	CardOutlineFactory.call(this);
}

eGKCardOutlineFactory.prototype = new CardOutlineFactory();
eGKCardOutlineFactory.constructor = eGKCardOutlineFactory;

eGKCardOutlineFactory.prototype.newDataOutline = function(data, format) {
	return new eGKDataOutline(this, data, format);
}



function readRootCVC(filename) {

	filename = GPSystem.mapFilename(filename);
	// Open stream
	var f = new java.io.FileInputStream(filename);

	// Determine file size
	var flen = f.available();

	// Allocate native byte array
	var bs = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, flen);

	// Read into byte array
	var len = f.read(bs);

	// Allocate JavaScript ByteBuffer from native/wrapped byte array
	var bb = new ByteBuffer(bs);

	// Convert to JavaScript ByteString
	var data = bb.toByteString();

	print(data);
	var tlv = new ASN1(data);
	print(tlv);

	var b = tlv.get(1).value.bytes(1);
	var tlv = new ASN1(b);
	print(tlv);
	print("PUK = " + tlv.get(0).value.toString(HEX));

	return data;
}
