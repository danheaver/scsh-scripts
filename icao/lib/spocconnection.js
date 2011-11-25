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
 * @fileoverview Connector implementing a web service interface to a SPOC for the
 * distribution of card verifiable certificates used for terminal authentication as defined in CSN 36 9791
 */



/**
 * Creates a web service connector to access services of a SPOC as defined in CSN 36 9791
 *
 * @class Class implementing a SPOC web service connector
 * @constructor
 * @param {String} url the web service endpoint
 */
function SPOCConnection(url) {
	this.url = url;
	this.soapcon = new SOAPConnection(SOAPConnection.SOAP11);
	this.verbose = true;
	this.lastReturnCode = null;
}



/**
 * Get the last return code
 *
 * @returns the last return code received or null if none defined
 * @type String
 */
SPOCConnection.prototype.getLastReturnCode = function() {
	return this.lastReturnCode;
}



/**
 * Close the connector and release allocated resources
 */
SPOCConnection.prototype.close = function() {
	this.soapcon.close();
}



/**
 * Obtain a list of certificates from the SPOC
 *
 * @param {String} callerID two letter country code of the calling CVCA
 * @param {String} messageID unique message id generated by the caller
 * @returns a lists of card verifiable certificates from the SPOC or null in case of error
 * @type ByteString[]
 */
SPOCConnection.prototype.getCACertificates = function(callerID, messageID) {

	this.lastReturnCode = null;

	var ns = new Namespace("http://namespaces.unmz.cz/csn369791");

	var request =
		<csn:GetCACertificatesRequest xmlns:csn={ns}>
			<csn:callerID>{callerID}</csn:callerID>
			<csn:messageID>{messageID}</csn:messageID>
		</csn:GetCACertificatesRequest>

	if (this.verbose) {
		GPSystem.trace(request.toXMLString());
	}

	this.request = request;

	try	 {
		var response = this.soapcon.call(this.url, request);
		if (this.verbose) {
			GPSystem.trace(response.toXMLString());
		}
	}
	catch(e) {
		GPSystem.trace("SOAP call to " + this.url + " failed : " + e);
		throw new GPError("SPOCConnection", GPError.DEVICE_ERROR, 0, "getCACertificates failed with : " + e);
	}
	
	this.response = response;
	
	var certlist = [];

	this.lastReturnCode = response.ns::result.toString();

	if (this.lastReturnCode == "ok_cert_available") {
		for each (var c in response.ns::certificateSequence.ns::certificate) {
			var cvc = new ByteString(c, BASE64);
			certlist.push(cvc);
			if (this.verbose) {
				GPSystem.trace(cvc);
			}
		}
	} else {
		return null;
	}

	return certlist;
}



/**
 * Request a certificate from the SPOC using a web service
 *
 * @param {String} callerID two letter country code of the calling CVCA
 * @param {String} messageID unique message id generated by the caller
 * @param {ByteString} certreq the certificate request
 * @returns the new certificates
 * @type ByteString[]
 */
SPOCConnection.prototype.requestCertificate = function(certreq, callerID, messageID) {

	var soapConnection = new SOAPConnection();

	var ns = new Namespace("http://namespaces.unmz.cz/csn369791");

	var request =
		<csn:RequestCertificateRequest xmlns:csn={ns}>
			<csn:callerID>{callerID}</csn:callerID>
			<csn:messageID>{messageID}</csn:messageID>
			<csn:certificateRequest>{certreq.toString(BASE64)}</csn:certificateRequest>
		</csn:RequestCertificateRequest>

	if (this.verbose) {
		GPSystem.trace(request.toXMLString());
	}

	this.request = request;

	try	{
		var response = this.soapcon.call(this.url, request);
		if (this.verbose) {
			GPSystem.trace(response.toXMLString());
		}
	}
	catch(e) {
		GPSystem.trace("SOAP call to " + this.url + " failed : " + e);
		throw new GPError("SPOCConnection", GPError.DEVICE_ERROR, 0, "RequestCertificate failed with : " + e);
	}
	
	this.response = response;

	var certlist = [];

	this.lastReturnCode = response.ns::result.toString();
	
	if (this.lastReturnCode == "ok_cert_available") {
		for each (var c in response.ns::certificateSequence.ns::certificate) {
			var cvc = new ByteString(c, BASE64);
			certlist.push(cvc);
			if (this.verbose) {
				GPSystem.trace(cvc);
			}
		}
	} else {
		return null;
	}

	return certlist;
}



/**
 * Send a certificate to the SPOC
 *
 * @param {ByteString[]} certificates the list of certificates to post or null
 * @param {String} callerID two letter country code of the calling CVCA
 * @param {String} messageID unique message id generated by the caller
 * @param {String} statusInfo the status info provided by the sender
 * @type String
 * @return the returnCode
 */
SPOCConnection.prototype.sendCertificates = function(certificates, callerID, messageID, statusInfo) {

	var soapConnection = new SOAPConnection();

	var ns = new Namespace("http://namespaces.unmz.cz/csn369791");

	var request =
			<csn:SendCertificatesRequest xmlns:csn={ns}>
				<csn:callerID>{callerID}</csn:callerID>
				<!--Optional:-->
				<csn:messageID>{messageID}</csn:messageID>
				<!--Optional:-->
				<csn:certificateSequence>
				</csn:certificateSequence>
				<csn:statusInfo>{statusInfo}</csn:statusInfo>
			</csn:SendCertificatesRequest>

	var list = request.ns::certificateSequence;

	if (certificates) {
		for (var i = 0; i < certificates.length; i++) {
			var cvc = certificates[i];
			list.ns::certificate += <ns:certificate xmlns:ns={ns}>{cvc.toString(BASE64)}</ns:certificate>
		}
	}

	if (this.verbose) {
		GPSystem.trace(request.toXMLString());
	}

	this.request = request;

	try	{
		var response = this.soapcon.call(this.url, request);
		if (this.verbose) {
			GPSystem.trace(response.toXMLString());
		}
	}
	catch(e) {
		GPSystem.trace("SOAP call to " + this.url + " failed : " + e);
		throw new GPError("SPOCConnection", GPError.DEVICE_ERROR, 0, "SendCertificates failed with : " + e);
	}

	this.response = response;

	this.lastReturnCode = response.ns::result.toString();
	
	return this.lastReturnCode;
}



/**
 * Convert a list of certificates in binary format to a list of CVC objects
 *
 * @param {ByteString[]} certlist the list of certificates
 * @type CVC[]
 * @return the list of certificate objects
 */
SPOCConnection.toCVCList = function(certlist) {
	var certs = [];
	for each (var cvcbin in certlist) {
		certs.push(new CVC(cvcbin));
	}
	return certs;
}



/**
 * Convert a list of certificate objects into a list of certificates in binary format
 *
 * @param {CVC[]} certlist the list of certificate objects
 * @type ByteString[]
 * @return the list of certificates
 */
SPOCConnection.fromCVCList = function(certlist) {
	var certs = [];
	for each (var cvc in certlist) {
		certs.push(cvc.getBytes());
	}
	return certs;
}



SPOCConnection.test = function() {
	var c = new SPOCConnection("http://localhost:8080/se/spoc");
	c.verbose = true;
	var certlist = c.getCACertificates("UT", "4711");
	for (var i = 0; i < certlist.length; i++) {
		print(certlist[i]);
	}
}
