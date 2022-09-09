#!/bin/bash
mdfile="$1"
file=${mdfile%.*} 
# echo $file
htmlfile="$file.html"
# echo $htmlfile
> $htmlfile
printf "<!DOCTYPE html>\n<html>\n<title>$2</title>\n<xmp theme=""spacelab"" style=""display:none;"">""\n" >> $htmlfile
cat $mdfile >> $htmlfile
printf "</xmp>\n<script src=""https://cdn.jsdelivr.net/gh/Naereen/StrapDown.js@master/strapdown.min.js""></script>\n</html>" >> $htmlfile