"use strict";

var LensConverter = require('lens/converter');

var LensArticle = require("lens/article");
var CustomNodeTypes = require("./nodes");

var CustomConverter = function (options) {
  LensConverter.call(this, options);
};

CustomConverter.Prototype = function () {

  this.test = function (xmlDoc) {
    // check  NLM jats elements
    var article = xmlDoc.querySelector("article");
    if (article != null) {
      return true;
    }
    return false;

  }

  // Override document factory so we can create a customized Lens article,
  // including overridden node types
  this.createDocument = function () {
    var doc = new LensArticle({
      nodeTypes: CustomNodeTypes
    });

    return doc;
  };

  this.captionNew = function (state, caption) {
    var doc = state.doc;
    var captionNode = {
      "id": state.nextId("caption"),
      "source_id": caption.getAttribute("id"),
      "type": "caption",
      "title": "",
      "children": []
    };
    // Titles can be annotated, thus delegate to paragraph
    var title = caption.querySelector("title");
    if (title) {
      // Resolve title by delegating to the paragraph
      var node = this.paragraph(state, title);
      if (node) {
        captionNode.title = node.id;
      }
    }
    var children = [];
    var paragraphs = caption.querySelectorAll("p");
    _.each(paragraphs, function (p) {
      // Only consider direct children
      if (p.parentNode !== caption) return;
      var node = this.paragraph(state, p);
      if (node) children.push(node.id);
    }, this);
    captionNode.children = children;
    doc.create(captionNode);
    return captionNode;
  };

  this.sanitizeXML = function (xmlDoc) {
    var paragraphs = xmlDoc.querySelectorAll("p");
    for (var i = 0; i < paragraphs.length; i++) {
      var paragraph = paragraphs[i];
      var parentNode = paragraph.parentNode;
      if (paragraph !== undefined && paragraph.innerHTML === "" && parentNode.tagName == "caption")
        paragraph.innerHTML = ".";

    }

    var figures = xmlDoc.querySelectorAll("fig");

    for (var i = 0; i < figures.length; i++) {
      var figure = figures[i];
      var hasCaption = false;
      for (var j = 0; j < figure.children.length; j++) {
        var child = figure.children[j];
        if (child.tagName === "caption") {
          hasCaption = true;
        }
      }
      if (hasCaption===false) {
        var caption = document.createElement("caption");
        var element = document.createElement("p");
        var content = document.createTextNode(".");
        element.appendChild(content);
        element.style.visibility = "hidden";
        caption.appendChild(element);
        figure.appendChild(caption);

      }
    }

    return xmlDoc;
  };


  this.citation = function(state, ref, citation) {
      var doc = state.doc;
      var citationNode;
      var i;

      var id = state.nextId("article_citation");

      // TODO: we should consider to have a more structured citation type
      // and let the view decide how to render it instead of blobbing everything here.
      var personGroup = citation.querySelector("person-group");

      // HACK: we try to create a 'articleCitation' when there is structured
      // content (ATM, when personGroup is present)
      // Otherwise we create a mixed-citation taking the plain text content of the element
      if (personGroup) {

        citationNode = {
          "id": id,
          "source_id": ref.getAttribute("id"),
          "type": "citation",
          "title": "N/A",
          "label": "",
          "authors": [],
          "doi": "",
          "source": "",
          "volume": "",
          "fpage": "",
          "lpage": "",
          "citation_urls": []
        };

        var nameElements = personGroup.querySelectorAll("name");
        for (i = 0; i < nameElements.length; i++) {
          citationNode.authors.push(this.getName(nameElements[i]));
        }

        // Consider collab elements (treat them as authors)
        var collabElements = personGroup.querySelectorAll("collab");
        for (i = 0; i < collabElements.length; i++) {
          citationNode.authors.push(collabElements[i].textContent);
        }

        var source = citation.querySelector("source");
        if (source) citationNode.source = source.textContent;

        var articleTitle = citation.querySelector("article-title");
        if (articleTitle) {
          citationNode.title = this.annotatedText(state, articleTitle, [id, 'title']);
        } else {
          var comment = citation.querySelector("comment");
          if (comment) {
            citationNode.title = this.annotatedText(state, comment, [id, 'title']);
          } else {
            // 3rd fallback -> use source
            if (source) {
              citationNode.title = this.annotatedText(state, source, [id, 'title']);
            } else {
              console.error("FIXME: this citation has no title", citation);
            }
          }
        }

        var volume = citation.querySelector("volume");
        if (volume) citationNode.volume = volume.textContent;

        var publisherLoc = citation.querySelector("publisher-loc");
        if (publisherLoc) citationNode.publisher_location = publisherLoc.textContent;

        var publisherName = citation.querySelector("publisher-name");
        if (publisherName) citationNode.publisher_name = publisherName.textContent;

        var fpage = citation.querySelector("fpage");
        if (fpage) citationNode.fpage = fpage.textContent;

        var lpage = citation.querySelector("lpage");
        if (lpage) citationNode.lpage = lpage.textContent;

        var year = citation.querySelector("year");
        if (year) citationNode.year = year.textContent;

        // Note: the label is child of 'ref'
        var label = ref.querySelector("label");
        if(label) citationNode.label = label.textContent;

        var doi = citation.querySelector("pub-id[pub-id-type='doi'], ext-link[ext-link-type='doi']");
        if(doi) citationNode.doi = "http://dx.doi.org/" + doi.textContent;

        var urs = citation.querySelector("pub-id[pub-id-type='urs'], ext-link[ext-link-type='urs']");
        if (urs){
            citationNode.citation_urls.push({ url: urs.textContent, name: 'URS: ' + urs.textContent });
        }
        
      } else {
        console.error("FIXME: there is one of those 'mixed-citation' without any structure. Skipping ...", citation);
        return;
        // citationNode = {
        //   id: id,
        //   type: "mixed_citation",
        //   citation: citation.textContent,
        //   doi: ""
        // };
      }

      doc.create(citationNode);
      doc.show("citations", id);

      return citationNode;
    };

  // Resolve figure urls
  // --------
  //
  

    this.enhanceFigure = function(state, node, element) {
      var graphic = element.querySelector("graphic");
      var url = graphic.getAttribute("xlink:href");
      node.url = this.resolveURL(state, url);
    };

  

  // Example url to JPG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.jpg
  
    this.resolveURL = function(state, url) {
      console.log(url);
    // Use absolute URL
    if (url.match(/http[s]:\/\//)) return url;

    // Look up base url
    var baseURL = this.getBaseURL(state);
    var u = new URL(state.xmlDoc.URL);

    console.log(baseURL);
    console.log(u);

    /*
    const params = new Proxy(new URLSearchParams(u.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });

    console.log(params.url);
    */
    var base = u.href.substring(0,u.href.lastIndexOf('/')+1);

    console.log(base);
    

    if (baseURL) {
      return [baseURL, url].join('');
    } else {
        // Use special URL resolving for production articles
        return [
            base,,
            "images/",
            url,
            ".jpg"
        ].join('');
    }
  };
  
  this.enhanceAnnotationData = function(state, anno, element, type) {
    
    anno.linktype = '';
    
    var extLinkType = element.getAttribute('ext-link-type') || '';
    if (type === "ext-link" && extLinkType === "urs") {
      //anno.url = el.getAttribute("xlink:href");
      anno.url = 'javascript:alert("' + element.getAttribute("xlink:href") + '");';
      anno.linktype = 'urs'
    }

  };

  /**
   this.enhanceVideo = function(state, node, element) {
    var href = element.getAttribute("xlink:href").split(".");
    var name = href[0];
    node.url = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file/"+name+".mp4";
    node.url_ogv = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file//"+name+".ogv";
    node.url_webm = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file//"+name+".webm";
    node.poster = "http://api.elifesciences.org/v2/articles/"+state.doc.id+"/media/file/"+name+".jpg";
  };
   **/
};


CustomConverter.Prototype.prototype = LensConverter.prototype;
CustomConverter.prototype = new CustomConverter.Prototype();
CustomConverter.prototype.constructor = CustomConverter;

module.exports = CustomConverter;
