   function parseNode(node1) {
            var obj = {
                tag: node1.tagName,
                attributes: {},
                node: node1,
                children: [],
            };
            const attrs = node1.attributes;
            for (let i = 0; i < attrs.length; i++) { const attr = attrs[i]; obj.attributes[attr.name] = attr.value; } for (let i = 0;
                i < node1.childNodes.length; i++) {
                const childNode = node1.childNodes[i]; if
                    (childNode.nodeType === Node.ELEMENT_NODE) { obj.children.push(parseNode(childNode)); } else if
                    (childNode.nodeType === Node.TEXT_NODE) {
                    if (childNode.textContent.trim()) {
                        const textContent = childNode.textContent;

                        obj.children.push({

                            tag: "textelement", attributes: encodeURI(textContent), node: childNode, children: []
                        });
                    }
                }
            } return obj;
        }

        function diff(arrBefore, arrAfter, parentNode) {

            var patch = [];
            if (arrBefore.length == 0) {
                patch.push({ type: "render-all", node: parentNode, value: arrAfter })
                return patch
            };
            if (arrAfter.length == 0) {
                patch.push({ type: "delete-all", node: parentNode })
                return patch
            };

            if (arrBefore.length > arrAfter.length && arrAfter.length > 0) {
                patch.push({ type: "delete-from", node: arrBefore[arrAfter.length - 1].node });

                arrBefore = arrBefore.slice(0, arrAfter.length);
            };
            var soonDelete = []
            var arrBeforeNoChildren = arrBefore.map(obj1 => ({ ...obj1, children: [], node: [] }));
            var arrAfterNoChildren = arrAfter.map(obj1 => ({ ...obj1, children: [], node: [] }));
            if (JSON.stringify(arrBeforeNoChildren) !== JSON.stringify(arrAfterNoChildren)) {
                for (let index = 0; index < arrBeforeNoChildren.length; index++) {
                    if (arrBeforeNoChildren[index].tag == arrAfterNoChildren[index].tag && JSON.stringify(arrAfterNoChildren[index].attributes) !== JSON.stringify(arrBeforeNoChildren[index].attributes)) {
                        patch.push({ type: "update", node: arrBefore[index].node, attributes: arrAfterNoChildren[index].attributes })

                    }
                    else if (arrBeforeNoChildren[index].tag !== arrAfterNoChildren[index].tag) {
                        if (arrBeforeNoChildren[index].tag == "textelement") {
                            patch.push({ type: "changefrom-text", node: arrBefore[index].node, parentnode: parentNode, value: arrAfter[index] })
                            soonDelete.push(index)

                        }
                        else if (arrAfterNoChildren[index].tag == "textelement") {
                            patch.push({ type: "changeto-text", node: arrBefore[index].node, parentnode: parentNode, value: arrAfter[index].attributes })
                            soonDelete.push(index)
                        }
                        else {
                            patch.push({ type: "change", node: arrBefore[index].node, parentnode: parentNode, value: arrAfter[index] })
                            soonDelete.push(index)

                        }
                    }
                }
            }
            if (arrBefore.length < arrAfter.length && arrBefore.length > 0) {
                patch.push({ type: "render-from", node: parentNode, value: arrAfter.slice(arrBefore.length) })
                arrAfter = arrAfter.slice(0, arrBefore.length)
            };
            for (var i = soonDelete.length - 1; i >= 0; i--) {
                arrBefore.splice(soonDelete[i], 1);
                arrAfter.splice(soonDelete[i], 1);
            }

            for (let i = 0; i < arrBefore.length; i++) {
                const arrBeforeChildren = arrBefore[i].children
                const arrAfterChildren = arrAfter[i].children
                if (arrAfterChildren.length > 0 || arrBeforeChildren.length > 0) {

                    patch.push(...diff(arrBeforeChildren, arrAfterChildren, arrBefore[i].node))
                }
            }
            return patch

        };


        function appendNodes(parentNode, instruction) {
            if (instruction.tag === 'textelement') {
                const textNode = document.createTextNode(decodeURI(instruction.attributes));
                parentNode.appendChild(textNode);
                return;
            }
            else {
                const newNode = document.createElement(instruction.tag);
                if (instruction.attributes) {
                    Object.keys(instruction.attributes).forEach(key => {
                        newNode.setAttribute(key, instruction.attributes[key]);
                    });
                }

                if (instruction.children) {
                    for (let index = 0; index < instruction.children.length; index++) {
                        appendNodes(newNode, instruction.children[index]);
                    }
                }

                parentNode.appendChild(newNode);
            }
        }


        function executePatch(patches) {
            for (let i = 0; i < patches.length; i++) {
                var node = patches[i].node
                switch (patches[i].type) {

                    case 'delete-from':
                        while (node.nextSibling) {
                            node.parentNode.removeChild(node.nextSibling);
                        }
                        break;
                    case 'update':
                        if (node.nodeType === Node.TEXT_NODE) {
                            node.nodeValue = decodeURI(patches[i].attributes);
                        }

                        if (node.nodeType === Node.ELEMENT_NODE) {
                            while (node.attributes.length > 0) {
                                node.removeAttribute(node.attributes[0].name);
                            }
                            for (const key in patches[i].attributes) {
                                node.setAttribute(key, patches[i].attributes[key]);
                            }
                        }
                        break;
                    case 'change':
                        var newNode = document.createElement(patches[i].value.tag)

                        if (patches[i].value.attributes) {
                            Object.keys(patches[i].value.attributes).forEach(key => {
                                newNode.setAttribute(key, patches[i].value.attributes[key]);
                            });
                        }
                        patches[i].value.children.forEach(child => {
                            appendNodes(newNode, child)

                        });
                        node.replaceWith(newNode)


                        break;
                    case 'changefrom-text':
                        var newNode = document.createElement(patches[i].value.tag)
                        for (const key in patches[i].value.attributes) {
                            newNode.setAttribute(key, patches[i].value.attributes[key]);
                        }
                        patches[i].value.children.forEach(child => {
                            appendNodes(newNode, child)

                        });
                        node.replaceWith(newNode)
                        break;
                    case 'changeto-text':

                        var newNode = document.createTextNode(decodeURI(patches[i].value))

                        node.replaceWith(newNode)

                        break;
                    case 'render-from':

                        for (let ii = 0; ii < patches[i].value.length; ii++) {
                            if (patches[i].value[ii].tag == "textelement") {
                                newNode = document.createTextNode(decodeURI(patches[i].value[ii].attributes))
                                node.appendChild(newNode)
                            }
                            else {
                                var newNode = document.createElement(patches[i].value[ii].tag)
                                for (const key in patches[i].value[ii].attributes) {
                                    newNode.setAttribute(key, patches[i].value[ii].attributes[key]);
                                }
                                patches[i].value[ii].children.forEach(child => {
                                    appendNodes(newNode, child)

                                });
                                node.appendChild(newNode)

                            };
                        }
                        break;

                    case 'delete-all':

                        node.innerHTML = ''
                        break;
                    case 'render-all':

                        for (let ii = 0; ii < patches[i].value.length; ii++) {
                            if (patches[i].value[ii].tag == "textelement") {
                                newNode = document.createTextNode(decodeURI(patches[i].value[ii].attributes))
                                node.appendChild(newNode)
                            }
                            else {
                                var newNode = document.createElement(patches[i].value[ii].tag)
                                for (const key in patches[i].value[ii].attributes) {
                                    newNode.setAttribute(key, patches[i].value[ii].attributes[key]);
                                }
                                patches[i].value[ii].children.forEach(child => {
                                    appendNodes(newNode, child)

                                });
                                node.appendChild(newNode)

                            };
                        }
                        break;

                    default:
                        console.error('Invalid instruction type:', patches[i].type);
                }

            }
        };

        function Render(string, root) {
            var doc = new DOMParser().parseFromString(string, "text/html");
            const a = diff(parseNode(root).children, parseNode(doc.querySelector('body')).children, root);

            executePatch(a);

            delete doc;
        }
