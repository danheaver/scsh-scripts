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
 * @fileoverview A simple CVCA web GUI
 */



/**
 * Create a CVCA web GUI
 * 
 * @class Class implementing a simple CVCA web user interface
 * @constructor
 * @param {CVCAService} service the service to which the GUI is attached
 */
function CVCAUI(service) {
	CommonUI.call(this, service);
}

CVCAUI.prototype = new CommonUI();
CVCAUI.constructor = CVCAUI;



/**
 * Serves a details page for pending GetCertifcate requests.
 *
 * <p>The URL processed has the format <caname>/getcert/<queueindex></p>
 *
 * @param {HttpRequest} req the request object
 * @param {HttpResponse} req the response object
 * @param {String[]} url array of URL path elements
 */
CVCAUI.prototype.handleGetCertificateRequestDetails = function(req, res, url) {

	var op = CertStoreBrowser.parseQueryString(req.queryString);
	
	var index = parseInt(op.index);
	var sr = this.service.getRequest(index);
	
	if (typeof(op.action) != "undefined") {
		if (op.action == "delete") {
			this.service.deleteRequest(index);
			this.serveRefreshPage(req, res, url);
		} else {
			sr.setStatusInfo(op.action);
			this.service.processRequest(index);
			this.serveRefreshPage(req, res, url);
		}
	} else {
		var page = 
			<div>
				<h1>Pending GetCertificates request</h1>
				<p>  MessageID: {sr.getMessageID()}</p>
				<p>  ResponseURL: {sr.getResponseURL()}</p>
				<h2>Possible actions:</h2>
				<ul>
					<li><a href={"getcert?index=" + op.index + "&action=ok_cert_available"}>Respond</a> with "ok_cert_available"</li>
					<li><a href={"getcert?index=" + op.index + "&action=failure_syntax"}>Respond</a> with "failure_syntax"</li>
					<li><a href={"getcert?index=" + op.index + "&action=failure_request_not_accepted"}>Respond</a> with "failure_request_not_accepted"</li>
					<li><a href={"getcert?index=" + op.index + "&action=delete"}>Delete</a> request without a response</li>
				</ul>
			</div>;

		this.sendPage(req, res, url, page);
	}
}



/**
 * Serves a details page for pending RequestCertificate requests.
 *
 * <p>The URL processed has the format <caname>/request/<queueindex></p>
 *
 * @param {HttpRequest} req the request object
 * @param {HttpResponse} req the response object
 * @param {String[]} url array of URL path elements
 */
CVCAUI.prototype.handleRequestCertificateRequestDetails = function(req, res, url) {

	var op = CertStoreBrowser.parseQueryString(req.queryString);
	
	var index = parseInt(op.index);
	var sr = this.service.getRequest(index);
	
	var certreq = sr.getCertificateRequest();
	certreq.decorate();
	
	if (typeof(op.action) != "undefined") {
		if (op.action == "delete") {
			this.service.deleteRequest(index);
			this.serveRefreshPage(req, res, url);
		} else {
			sr.setStatusInfo(op.action);
			this.service.processRequest(index);
			this.serveRefreshPage(req, res, url);
		}
	} else {
		var page = 
			<div>
				<h1>Pending RequestCertificate request</h1>
				<p>  MessageID: {sr.getMessageID()}</p>
				<p>  ResponseURL: {sr.getResponseURL()}</p>
				<h2>Possible actions:</h2>
				<ul>
					<li><a href={"request?index=" + op.index + "&action=ok_cert_available"}>Respond</a> with "ok_cert_available"</li>
					<li><a href={"request?index=" + op.index + "&action=failure_syntax"}>Respond</a> with "failure_syntax"</li>
					<li><a href={"request?index=" + op.index + "&action=failure_inner_signature"}>Respond</a> with "failure_inner_signature"</li>
					<li><a href={"request?index=" + op.index + "&action=failure_outer_signature"}>Respond</a> with "failure_outer_signature"</li>
					<li><a href={"request?index=" + op.index + "&action=failure_request_not_accepted"}>Respond</a> with "failure_request_not_accepted"</li>
					<li><a href={"request?index=" + op.index + "&action=delete"}>Delete</a> request without a response</li>
				</ul>
				<pre>{certreq.getASN1()}</pre>
			</div>;

		this.sendPage(req, res, url, page);
	}
}



/**
 * Serve the status page
 *
 * @param {HttpRequest} req the request object
 * @param {HttpResponse} req the response object
 */
CVCAUI.prototype.serveStatusPage = function(req, res, url) {

	// Handle status page
	// ToDo: Refactor to getter
	var status = this.service.cvca.isOperational() ? "operational" : "not operational";

	var page =
		<div>
			<h1>CVCA Service {status}</h1>
			<div id="activechain"/>
			<div id="pendingrequests"/>
			<h2>Possible actions:</h2>
			<ul>
			</ul>
			<p><a href={url[0] + "/holderlist?path=" + this.service.path }>Browse Document Verifier...</a></p>
		</div>
	
	var l = page.ul;
	
	// ToDo: Refactor to getter
	if (this.service.cvca.isOperational()) {
		l.li += <li><a href="?link">Generate link certificate without domain parameter</a></li>
		l.li += <li><a href="?linkdp">Generate link certificate with domain parameter</a></li>
		l.li += <li><a href="?linkdp100">Generate 100 link certificate with domain parameter</a></li>
	} else {
		l.li += <li><a href="?linkdp">Generate root certificate</a></li>
	}
	
	// ToDo: Refactor to getter
	var certlist = this.service.cvca.getCertificateList();
	
	if (certlist.length > 0) {
		var t = <table class="content"/>;

		t.tr += <tr><th>CHR</th><th>CAR</th><th>Type</th><th>Effective</th><th>Expiration</th></tr>;

		var i = certlist.length - 6;
		if (i <= 0) {
			i = 0;
		} else {
			refurl = url[0] + "/certlist?path=" + this.service.path;
			t.tr += <tr><td><a href={refurl}>Older ...</a></td><td></td><td></td><td></td><td></td></tr>;
		}
		
		for (; i < certlist.length; i++) {
			var cvc = certlist[i];
			var selfsigned = cvc.getCHR().equals(cvc.getCAR());
			var refurl = url[0] + "/cvc?" + 
							"path=" + this.service.path + "&" +
							"chr=" + cvc.getCHR().toString() + "&" +
							"selfsigned=" + selfsigned;
			t.tr += <tr>
				<td><a href={refurl}>{cvc.getCHR().toString()}</a></td>
				<td>{cvc.getCAR().toString()}</td>
				<td>{cvc.getType()}</td>
				<td>{cvc.getCED().toLocaleDateString()}</td>
				<td>{cvc.getCXD().toLocaleDateString()}</td>
			</tr>
		}
	
		// Certificate list
		var div = page.div.(@id == "activechain");
		div.h2 = "Active certificate chain:";
		div.appendChild(t);
	}
	
	var queue = this.service.listRequests();

	if (queue.length > 0) {
		var t = <table class="content"/>;

		t.tr += <tr><th width="20%">MessageID</th><th>Request</th><th>Status</th><th>Final Status</th></tr>;

		for (var i = 0; i < queue.length; i++) {
			var sr = queue[i];

			if (sr.isCertificateRequest()) {
				var refurl = url[0] + "/request?index=" + i;
				var reqstr = sr.getCertificateRequest().toString();
			} else {
				var refurl = url[0] + "/getcert?index=" + i;
				var reqstr = "GetCertificates";
			}
			var status = sr.getStatusInfo();
			if (!status) {
				status = "Undefined";
			}
			var finalStatus = sr.getFinalStatusInfo();
			if (!finalStatus) {
				finalStatus = "Not yet send";
			}
			t.tr += <tr>
				<td><a href={refurl}>{sr.getMessageID()}</a></td>
				<td>{reqstr}</td>
				<td>{status}</td>
				<td>{finalStatus}</td>
			</tr>
		}

		// Pending requests list
		var div = page.div.(@id == "pendingrequests");
		div.h2 = "Inbound requests:";
		
		div.appendChild(t);
	}

	this.sendPage(req, res, url, page);
}



/**
 * Dispatch all GET inquiries
 *
 * @param {HttpRequest} req the request object
 * @param {HttpResponse} req the response object
 */
CVCAUI.prototype.handleInquiry = function(req, res) {
	// pathInfo always starts with an "/"
	var url = req.pathInfo.substr(1).split("/");

	// Handle details
	if (url.length > 1) {
		var detailsType = url[1];
//		GPSystem.trace("Handle details for :" + detailsType);
		switch(detailsType) {
		case "cvc":
			this.handleCertificateDetails(req, res, url);
			break;
		case "certlist":
			this.handleCertificateList(req, res, url);
			break;
		case "holderlist":
			this.handleCertificateHolderList(req, res, url);
			break;
		case "getcert":
			this.handleGetCertificateRequestDetails(req, res, url);
			break;
		case "request":
			this.handleRequestCertificateRequestDetails(req, res, url);
			break;
		default:
			res.setStatus(HttpResponse.SC_NOT_FOUND);
		}
	} else {
		// Handle operations
		var operation = req.queryString;

		switch(operation) {
		case "link":
			this.service.generateLinkCertificate(false);
			this.serveRefreshPage(req, res, url);
			break;
		case "linkdp":
			this.service.generateLinkCertificate(true);
			this.serveRefreshPage(req, res, url);
			break;
		case "linkdp100":
			for (var i = 0; i < 100; i++) {
				this.service.generateLinkCertificate(true);
			}
			this.serveRefreshPage(req, res, url);
			break;
		default:
			this.serveStatusPage(req, res, url);
		}
	}
}