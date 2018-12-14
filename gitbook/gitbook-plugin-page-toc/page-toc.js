require(['gitbook'], function(gitbook) {

    var selector;
    var position;
    var showByDefault;

    anchors.options = {
        placement: 'left'
    }

    gitbook.events.bind('start', function(e, config) {
        selector = config['page-toc'].selector;
        position = config['page-toc'].position;
        showByDefault = config['page-toc'].showByDefault;
    });

    gitbook.events.bind('page.change', function() {

        var addNavItem = function(ul, href, text) {
            var listItem = document.createElement('li'),
                anchorItem = document.createElement('a'),
                textNode = document.createTextNode(text);
            anchorItem.href = href;
            ul.appendChild(listItem);
            listItem.appendChild(anchorItem);
            anchorItem.appendChild(textNode);
        };

        var anchorLevel = function(nodeName) {
            return parseInt(nodeName.charAt(1));
        };

        var navTreeNode = function(current, moveLevels) {
            var e = current;
            if (moveLevels > 0) {
                var ul;
                for (var i = 0; i < moveLevels; i++) {
                    ul = document.createElement('ul');
                    e.appendChild(ul);
                    e = ul;
                }
            } else {
                for (var i = 0; i > moveLevels; i--) {
                    e = e.parentElement;
                }
            }
            return e;
        }

        anchors.removeAll();
        anchors.add(selector);

        var showToc = gitbook.state.page.showToc;

        if (anchors.elements.length > 1 && (showByDefault || showToc) && showToc != false) {
            var text, href, currentLevel;
            var prevLevel = 0;
            var nav = document.createElement('nav');
            nav.className = 'page-toc';
            var container = nav;
            for (var i = 0; i < anchors.elements.length; i++) {
                text = anchors.elements[i].textContent;
                href = anchors.elements[i].querySelector('.anchorjs-link').getAttribute('href');
                currentLevel = anchorLevel(anchors.elements[i].nodeName);
                container = navTreeNode(container, currentLevel - prevLevel);
                addNavItem(container, href, text);
                prevLevel = currentLevel;
            }

            if (position === 'top') {
                var section = document.body.querySelector('.markdown-section');
                section.insertBefore(nav, section.firstChild);
            } else {
                var first = anchors.elements[0];
                first.parentNode.insertBefore(nav, first);
            }
        }

    })

});
