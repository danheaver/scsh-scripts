/**
 *  ---------
 * |.##> <##.|  Open Smart Card Development Platform (www.openscdp.org)
 * |#       #|  
 * |#       #|  Copyright (c) 1999-2010 CardContact Software & System Consulting
 * |'##> <##'|  Andreas Schwier, 32429 Minden, Germany (www.cardcontact.de)
 *  --------- 
 *
 *  This file is part of OpenSCDP.
 *
 *  OpenSCDP is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License version 2 as
 *  published by the Free Software Foundation.
 *
 *  OpenSCDP is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with OpenSCDP; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * @fileoverview Simple CVC-CA for testing purposes
 */


if (typeof(__ScriptingServer) == "undefined") {
	load("../cvcertstore.js");
	load("../EAC2CVRequestGenerator.js");
	load("../EAC2CVCertificateGenerator.js");
}



/**
 * Creates a new CVC-CA instance
 *
 * @class Class supporting a certification authority that can issue CVC certificates
 * for the EAC protocol.
 *
 * @constructor
 * @param {Crypto} crypto the crypto provider to use
 */
function CVCCA(crypto, certstore, holderId, parentId) {
	this.crypto = crypto;
	this.certstore = certstore;
	this.holderId = holderId;
	this.parentId = parentId;
	
	if (this.isRootCA()) {		// CVCA
		this.path = holderId;
	} else {					// DVCA
		this.path = parentId + "/" + holderId;
	}
	this.keyspec = new Key();
	this.keyspec.setComponent(Key.ECC_CURVE_OID, new ByteString("1.3.36.3.3.2.8.1.1.8", OID));
	this.taAlgorithmIdentifier = new ByteString("id-TA-ECDSA-SHA-256", OID);
	this.pki = new ByteString("id-IS", OID);
}



/**
 * Returns true if this is a root CA
 *
 * @returns true if this is a root CA
 * @type boolean
 */
CVCCA.prototype.isRootCA = function() {
	return this.holderId == this.parentId;
}



/**
 * Generate a certificate request
 *
 * @return the certificate request
 * @type CVC
 */
CVCCA.prototype.generateRequest = function() {

	// Obtain key parameter

	var prk = new Key(this.keyspec);
	prk.setType(Key.PRIVATE);
	var puk = new Key(this.keyspec);
	puk.setType(Key.PUBLIC);

	// Determine CHR
	var currentchr = this.certstore.getCurrentCHR(this.path);
	var nextchr = this.certstore.getNextCHR(this.path);
	
	// Generate key pair
	this.crypto.generateKeyPair(Crypto.EC, puk, prk);
	
	// Save private key
	this.certstore.storePrivateKey(this.path, nextchr, prk);
	
	// Generate certificate request
	var reqGenerator = new EAC2CVRequestGenerator(this.crypto);

	// Set CPI
	reqGenerator.setProfileIdentifier(0x00);

	// Set public key for request
	reqGenerator.setPublicKey(puk);

	// Set oid of algorithm
	reqGenerator.setTAAlgorithmIdentifier(this.taAlgorithmIdentifier);

	// Set CHR for the request
	reqGenerator.setCHR(nextchr);

	if (currentchr != null) {
		var previousprk = this.certstore.getPrivateKey(this.path, currentchr);
		// ToDo include CAR of current certificate
		var req = reqGenerator.generateAuthenticatedCVRequest(prk, previousprk, currentchr);
	} else {
		// Generate the request
		var req = reqGenerator.generateCVRequest(prk);
	}
	
	req = new CVC(req);
	
	this.certstore.storeRequest(this.path, req);
	
	return req;
}



/**
 * Generate certificate for certificate request
 *
 * @param {CVC} req the certificate request
 * @param {Object} policy the object with policy settings
 * @returns the certificate
 * @type CVC
 */
CVCCA.prototype.generateCertificate = function(req, policy) {
	var car = this.certstore.getCurrentCHR(this.path);
	
	if (car == null) {				// No CA certificate found
		if (this.isRootCA()) {
			car = req.getCHR();		// Generate a self-signed root certificate
		} else {
			throw new GPError("CVCCA", GPError.INVALID_DATA, 0, "No current certificate found");
		}
	} else {
		if ((car.toString() == req.getCHR().toString()) && !(policy.selfSign)) {
			throw new GPError("CVCCA", GPError.INVALID_DATA, 0, "Self-signing is not allowed");
		}
	}
	
	var generator = new EAC2CVCertificateGenerator(this.crypto);
	generator.setCAR(car);
	generator.setCHR(req.getCHR());
	var effDate = new Date();
	var expDate = new Date(policy.certificateValidityDays * (1000 * 60 * 60 * 24) + effDate.getTime());
	generator.setEffectiveDate(effDate);
	generator.setExpiryDate(expDate);
	generator.setChatOID(this.pki);
	generator.setChatAuthorizationLevel(policy.chat);
	generator.setPublicKey(req.getPublicKey());
	generator.setProfileIdentifier(0x00);
	generator.setTAAlgorithmIdentifier(this.taAlgorithmIdentifier);
	generator.setIncludeDomainParameters(policy.includeDP);

	var prk = this.certstore.getPrivateKey(this.path, car);
	var cvc = generator.generateCVCertificate(prk, Crypto.ECDSA_SHA256);
	return cvc;
}



/**
 * Import a certificate into the certificate store
 *
 * @param {CVC} cert the certificate
 */
CVCCA.prototype.importCertificate = function(cert) {
	var prk = this.certstore.getPrivateKey(this.path, cert.getCHR());
	if (prk == null) {
		throw new GPError("CVCCA", GPError.INVALID_DATA, 0, "Invalid certificate");
	}
	this.certstore.storeCertificate(this.path, cert, true);
}



/**
 * Import a list of certificates into the certificate store
 *
 * @param {CVC[]} certs the list of certificates
 */
CVCCA.prototype.importCertificates = function(certs) {
	var mycerts = [];
	var othercerts = [];

	// Separate my certificates from all others
	for (var i = 0; i < certs.length; i++) {
		var cvc = certs[i];
		var chr = cvc.getCHR();
		if (this.holderId == chr.getHolder()) {
			mycerts.push(cvc);
		} else {
			othercerts.push(cvc);
		}
	}
	
	// Insert all other certificates into certificate store
	var list = this.certstore.insertCertificates(this.crypto, othercerts, true);
	
	// Process my own certificates. Should be one at maximum, matching a request
	for (var i = 0; i < mycerts.length; i++) {
		var cert = mycerts[i];
		var chr = cert.getCHR();
		
		var cert = this.certstore.getCertificate(this.path, chr);
		if (cert != null) {
			GPSystem.trace("We already have " + cert.toString() + " - ignored...");
		} else {
			var prk = this.certstore.getPrivateKey(this.path, chr);
			if (prk == null) {
				GPSystem.trace("We do not have a key for " + cert.toString() + " - ignored...");
			} else {
				this.certstore.storeCertificate(this.path, cert, true);
			}
		}
	}
	
	return list;
}



/**
 * Returns a list of relevant certificates.
 *
 * <p>If the CA is the root CA, then all self-signed and link certificates are returned.</p>
 * <p>If the CA is a DVCA, then all certificates of the associated root and the current
 *    DVCA certificate is returned.</p>
 *
 */
CVCCA.prototype.getCertificateList = function() {
	var path = this.path;
	
	if (!this.isRootCA()) {
		path = this.parentId;
	}

	var list = this.certstore.listCertificates(path);

	if (!this.isRootCA()) {
		var chr = this.certstore.getCurrentCHR(this.path);
		list.push(this.certstore.getCertificate(this.path, chr));
	}
	
	return list;
}



CVCCA.testPath = GPSystem.mapFilename("cvc", GPSystem.CWD);

CVCCA.test = function() {
	
	var crypto = new Crypto();
	
	var ss = new CVCertificateStore(CVCCA.testPath + "_cvca");
	var cvca = new CVCCA(crypto, ss, "UTCVCA", "UTCVCA");
	
	// Create a new request
	var req = cvca.generateRequest();
	print("Request: " + req);
	print(req.getASN1());
	
	assert(req.verifyWith(crypto, req.getPublicKey()));
	
	// Create self-signed or link certificate based on request
	var policy = { certificateValidityDays: 2,
				   chat: new ByteString("E3", HEX),
				   includeDP: true
				 };
	var cert = cvca.generateCertificate(req, policy);
	print("Certificate: " + cert);
	print(cert.getASN1());

	// Import certificate into store, making it the most current certificate
	cvca.importCertificate(cert);
	
	// Generate additional self-signed root certificate
	// This must be done after the link certificate has been imported
	var policy = { certificateValidityDays: 2,
				   chat: new ByteString("E3", HEX),
				   includeDP: true,
				   selfSign: true
				 };
	var cert = cvca.generateCertificate(req, policy);
	print("Certificate: " + cert);
	print(cert.getASN1());
	
	var ss = new CVCertificateStore(CVCCA.testPath + "_dvca");
	var dvca = new CVCCA(crypto, ss, "UTDVCA", "UTCVCA");
	
	var certlist = cvca.getCertificateList();
	var list = dvca.importCertificates(certlist);
	
	if (list.length > 0) {
		print("Warning: Could not import the following certificates");
		for (var i = 0; i < list.length; i++) {
			print(list[i]);
		}
	}
	
	// Create a new request
	var req = dvca.generateRequest();
	print("Request: " + req);
	print(req.getASN1());
	
	// Sign this request with root CA
	// This must be done after the link certificate has been imported
	var policy = { certificateValidityDays: 2,
				   chat: new ByteString("A3", HEX),
				   includeDP: false
				 };
	var cert = cvca.generateCertificate(req, policy);
	print("Certificate: " + cert);
	print(cert.getASN1());
	dvca.importCertificate(cert);
	
}


CVCCA.test();
