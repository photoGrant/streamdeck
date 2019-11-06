<?xml version="1.0" encoding="UTF-8"?>
<!-- Copyright (c) 2007 Phase One. All rights reserved -->

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<!-- <xsl:output encoding="UTF-8" indent="no" method="xml" 
		doctype-public="-//W3C//DTD XHTML 1.0 Strict//EN" 
		doctype-system="http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"/> -->
	<xsl:output encoding="UTF-8" indent="yes" method="html" 
		doctype-public="-//W3C//DTD HTML 4.01//EN" />
	
	<!-- Main document -->
	<xsl:template match="/">
		<html>
		<head>
			<title><xsl:value-of select="contactsheet/info/sheet-title" /></title>
			<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
			<meta name="generator" content="Capture One http://phaseone.com/" />
			<meta name="author" content="{contactsheet/info/author}" />
            
            <style type="text/css">
                html, body { background-color: #ccc;}
            </style>
            
			<link rel="stylesheet" type="text/css" media="screen, print" href="theme/slimbox.css" />
			<link rel="stylesheet" type="text/css" media="screen, print" href="theme/contactsheet.css" />
			<xsl:comment><![CDATA[[if IE]>
			<link rel="stylesheet" type="text/css" media="screen, print" href="theme/contactsheet_ie.css">
			<![endif]]]></xsl:comment>
			<script type="text/javascript" src="scripts/jquery.min.js"></script>
			<script type="text/javascript" src="scripts/slimbox2.js"></script>
			<script type="text/javascript">
			function wcs_thumbnail_size_changed (newSize) {
				<!-- The sole purpose of this function is to offer correct live preview in Capture One -->		
				$('.thumbnail-box').css({
					width: (newSize + 20),
					height: (newSize + 30)
				});
			}
			</script>
		</head>
			<xsl:apply-templates />
		</html>
	</xsl:template>
	
	<!-- TEMPLATES -->
	
	<xsl:template match="contactsheet">
		<body>
			<div id="info-box">
				<h1 id="wcs-title"><xsl:value-of select="info/sheet-title" /></h1>
				<p id="wcs-description"><xsl:value-of select="info/sheet-description" /></p>
			</div>
			<xsl:apply-templates />
			<div id="copyright-box">Copyright © <a href="{info/contact-link}" id="wcs-contact-link"><xsl:value-of select="info/contact" /></a></div>
		</body>
	</xsl:template>

	<!-- Make ordered list of photos -->
	<xsl:template match="contactsheet/selection">
		<div id="grid-box">
			<ol id="wcs-list">
				<xsl:apply-templates />
			</ol>
		</div>
	</xsl:template>
	
	<!-- Add photo to ordered list -->
	<xsl:template match="contactsheet/selection/photo">
		<li>
			<div class="thumbnail-box" style="width: {/contactsheet/settings/thumbnail-dimension + 20}px; height: {/contactsheet/settings/thumbnail-dimension + 30}px;">
				<span class="edge"></span>
				<span class="container">
					<a href="{preview-path}" title="{caption}" rel="lightbox[{/contactsheet/info/sheet-title}]">
					<img src="{thumbnail-path}" title="" alt="" class="thumbnail" id="wcs-img-{@id}" />
					</a>
				</span>
				<div id="wcs-caption-{@id}" class="caption-box">
					<xsl:value-of select="caption" />
				</div>
			</div>
		</li>
	</xsl:template>
	
	<xsl:template match="*">
	</xsl:template>
	
</xsl:stylesheet>
