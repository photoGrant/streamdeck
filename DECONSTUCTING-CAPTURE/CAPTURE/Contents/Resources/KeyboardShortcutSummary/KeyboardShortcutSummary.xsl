<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:template match="/keyboard_shortcuts">
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<title>Capture One Keyboard Shortcuts - <xsl:value-of select="@set_name"/></title>
	<style type="text/css">
		/* CSS Reset */
		* {
			vertical-align: baseline;
			font-weight: inherit;
			font-family: inherit;
			font-style: inherit;
			font-size: 100%;
			border: 0 none;
			outline: 0;
			padding: 0;
			margin: 0;
			}

		body {
			font-family: Helvetica, arial sans-serif;
			font-size: 11pt;
		}
		#container {
			margin-left: 10px;
			margin-right: 10px;
		}

		/* Page Title */
		h1 {
			font-weight: bold;
			font-size: 16pt;
		}
		/* Shortcut Set name */
		h2 {
			font-weight: bold;
			font-size: 14pt;
			margin-bottom: 20px;
		}
		/* Group name */
		h3 {
			display: inline;
			font-size: 12pt;
			padding-left: 10px; padding-right: 10px;
			border: 1px solid #cccccc;
			border-bottom-width: 0px;	
			background-color: #f5f5f5;
			font-weight: bold;
			padding-top: 2px;
		}

		table {
			border: 1px solid #cccccc;
			border-bottom-width: 0px;
			margin-bottom: 20px;
		}
		tr { 
			background-color: white;
		}
		tr.odd { 
			background-color: #f5f5f5; 
		}
		td {
			padding-right: 10px; padding-left: 10px;
			border-bottom: 1px solid #cccccc; 
		}
		td.command {
			width: 300pt;
		}
		td.key {
			width: 50pt;
		}

	</style>
</head>
<body>
	<div id="container">
		<h1><xsl:value-of select="@title"/></h1>
		<h2><xsl:value-of select="@set_name"/></h2>
		
		<xsl:for-each select="group">
		<h3><xsl:value-of select="@group_name"/></h3>
		<table cellspacing="0">
			<xsl:for-each select="shortcut">
			<tr>
				<xsl:if test="position() mod 2 != 1">
					<xsl:attribute name="class">odd</xsl:attribute>
				</xsl:if>
				<td class="command"><xsl:value-of select="@command"/></td>
				<td class="key"><xsl:value-of select="."/></td>
			</tr>
			</xsl:for-each>
		</table>
		</xsl:for-each>
	</div>
</body>
</html>
</xsl:template>

</xsl:stylesheet>