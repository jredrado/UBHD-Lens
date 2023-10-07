var AnnotationView = require('../../../node_modules/lens/article/nodes/annotation').View;

var LinkView = function(node) {
  AnnotationView.call(this, node);
};

LinkView.Prototype = function() {

  this.createElement = function() {
    var el = document.createElement('a');
    el.setAttribute('href', this.node.url);

    //TO FIX. Include linktype in Annotation schema and prototype
    if (this.node.properties.linktype !='urs') {
      el.setAttribute("target","_blank");
    }
    return el;
  };

  this.setClasses = function() {
    this.$el.addClass('link');
  };

};
LinkView.Prototype.prototype = AnnotationView.prototype;
LinkView.prototype = new LinkView.Prototype();

module.exports = LinkView;
