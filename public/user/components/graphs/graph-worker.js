onmessage = function(e) {

  var parameters = e.data;
  if(parameters[5] == undefined || parameters[5] == 0)
    draw_graph(JSON.parse(parameters[0]), parameters[1], parameters[2], parameters[3], parameters[4]);
  else if(parameters[5] == 1)
    draw_linear(JSON.parse(parameters[0]), parameters[1], parameters[2], parameters[3], parameters[4]);
  else 
    draw_author(JSON.parse(parameters[0]), parameters[1], parameters[2], parameters[3], parameters[4]);

}

var draw_author =  function(graph, threshold, supernodeId, max_width, max_height){

  var sortFn = function (ele1, ele2) {
    return ( ele1.dateCreated < ele2.dateCreated ? -1 : 1)
  }

  // Sort the nodes first
  var sortedNodes = graph.nodes.sort( sortFn );

  var radii = [];
  var count = 0;
  var angleInc = 2*Math.PI/120; 
  sortedNodes.map(function(node, index){

    var author = node.createdBy; 
    var size =  15//10 + (node.incomers.length + node.successors/5 + node.predecessors.length/2);

    if(radii[author] == undefined){
      var angle = count*(angleInc);
      radii[author] = [ angle, 2*size ];
      count ++;
      node.position = { x: max_width/2 + (200+radii[author][1])*Math.cos(radii[author][0]), y: max_height/2 + (200+radii[author][1])*Math.sin(radii[author][0]) }; 
      node.radius = size;
    }
    else{
      radii[author][1] += 2*size;
      node.radius = size;  
      node.position = { x: max_width/2 + (200+radii[author][1])*Math.cos(radii[author][0]), y: max_height/2  + (200+radii[author][1])*Math.sin(radii[author][0]) }; 
    }

    
  })

  postMessage(JSON.stringify(graph));

}

var draw_linear = function(graph, threshold, supernodeId, max_width, max_height){

  var sortFn = function (ele1, ele2) {
    return ( ele1.dateCreated < ele2.dateCreated ? -1 : 1)
  }

  // Sort the nodes first
  var sortedNodes = graph.nodes.sort( sortFn );

  var init = sortedNodes[0].dateCreated;

  var dateMap = [];
  sortedNodes.map(function(node, index){

    var x = Math.round( ( (node.dateCreated - init) / 86400 ) / 1000 ); 
    var y = node.dateCreated % 86400000 ;

    var size =  10 + (node.incomers.length + node.successors/5 + node.predecessors.length/2);

    if(dateMap[x] !== undefined){
      dateMap[x]+=size;
    }
    else
      dateMap[x] = size;

    node.position = { x: x*30 , y: dateMap[x] }; 
    node.radius = size;
    
  })

  postMessage(JSON.stringify(graph));

}


// number of incomers above which the node is placed on the spiral
// always double of number of incoming nodes required
var draw_graph = function(graph, threshold, supernodeId, max_width, max_height){

  var nodeHash = graph.nodes.hash();

  var sortFn = function (ele1, ele2) {
    return ( ele1.incomers.length > ele2.incomers.length ? -1 : 1);
  }


  // Sort the nodes first
  var sortedNodes = graph.nodes.sort( sortFn );

  // Extract nodes which will be on the spiral, including all children
  var spiralNodes = sortedNodes.filter(function(node){

      // this node will go on the spiral
      // hence all its parents should be marked
      if(node.incomers.length >= threshold && node.id != supernodeId){
        
            // mark the node to be on the spiral
            node.onSpiral =  node.id ;

            var inc = 0;
            // mark all the parents to be on the spiral with this node
            node.incomers.map(function(childId){

              var child = nodeHash[childId];

              if( child.onSpiral == -1 && inc < 5*threshold && child.incomers.length < threshold){

                  child.onSpiral = node.id;
                  inc++;
              }

            });

            return true;
      
      }
      else{

            // node is not on the spiral due to less number of predecessors
            // check if it is part of another node already on the spiral
            // 
            if( node.onSpiral !== -1 ){
              //console.log("Node already part of the spiral");
            }
            
        return false;
      }
  });


  // add additional ones which are isolated
  function isIsolated(nodeIndex){

      var node = sortedNodes[nodeIndex];

      if(node.onSpiral == -1){

          // add node to spiral
          spiralNodes.push(node);
          node.onSpiral = node.id
   
          // mark nodes predessors
          for(var i=0; i < node.incomers.length; i++){

              var child = nodeHash[node.incomers[i]];
              if( child.onSpiral == -1 ){
                child.onSpiral = node.id;
              }

          } 
          
      }

      if(nodeIndex+1 < graph.nodes.length)
        isIsolated(nodeIndex+1);

  }
  isIsolated(0);

  spiralNodes = spiralNodes.sort( sortFn );

  var angle = 2 * Math.PI / spiralNodes.length;
  var radius = 0.5*max_width;

  var initX = max_width/2;
  var initY = max_height/2;
      
  var prevRadius = 1;
  var x = 0;
  var y = 0;
  var radius = 150;
  var angle = 0;
  

  // for each node on the spiral, make a spiral of all its predecessors around it
  var num_of_cols = 5*max_width / 250; 
  var nextNode = function(i){

      // node on spiral
      var node = spiralNodes[i];

      x = radius*Math.cos( angle ) + initX;
      y = radius*Math.sin( angle ) + initY;
      
      node.position = { x: x, y: y}; 
      node.radius = placeSubSpirals(node, i);

  }

  var placeSubSpirals = function(node, i){

    // find the children
    var nodes = node.incomers.filter(function(nodeId){
      var subNode = nodeHash[nodeId];
      if(subNode.onSpiral == node.id)
        return true;
      else 
        return false;
    }); 

    var position = node.position; 

    // make a smaller spiral of all the incomers
    // get the radius of the smaller spiral
    prevRadius = makeSubSpiral(nodes, position.x, position.y, 30) ;


    // use the radius of the above spiral to place next node
    //x += initX + prevRadius;
    minNodes = Math.floor( 2 * Math.PI * radius / prevRadius );

    // for minNodes
    angleInc = 2*Math.PI / minNodes; 
    radiusInc = (prevRadius + 30) / minNodes; 

    angle += 2*angleInc;
    radius += 4*radiusInc;

    x = radius*Math.cos( angle ) + initX;
    y = radius*Math.sin( angle ) + initY;
    
    if( i+1 < spiralNodes.length ){
      nextNode(i+1);
    }
    else{
      postMessage(JSON.stringify(graph));
      // do something after graphing finished
    }
  }


  /*
   * In this case, the centre position being passed is already occupied
   * Return resulting radius of the subspiral
   * Perfect spiral - donot edit further!
   */
  var makeSubSpiral = function(nodes, centerX, centerY, minimumRadius){

      var radius_SubNode = 10;
      var safety_gap = 20;

      var deltaX = (centerX - initX);
      var deltaY = (centerY - initY);

      var angle = Math.atan( deltaY / deltaX ), 
          radius = minimumRadius, minNodes, angleInc, radiusInc;

      // Angle Correction
      //                |
      //       x-ve     |     x +ve
      //       y-ve     |     y -ve
      //                |
      //  --------------------------------
      //                |     
      //       x -ve    |     x +ve
      //       y +ve    |     y +ve
      //                |
      // https://www.mathworks.com/matlabcentral/answers/9330-changing-the-atan-function-so-that-it-ranges-from-0-to-2-pi?requestedDomain=www.mathworks.com
      if(deltaY > 0 && deltaX < 0)
        angle = Math.PI  + angle;
      else if(deltaY < 0 && deltaX < 0)
        angle = -Math.PI + angle;
      else if(deltaY > 0 && deltaX ==0 )
        angle = -Math.PI/2
      else if(deltaY < 0 && deltaX == 0)
        angle = -Math.PI/2

      if(angle < 0)
        angle = angle + 2*Math.PI



      for(var i=0; i < nodes.length; i++){

        var node = nodeHash[nodes[i]];

        minNodes = Math.floor( 2 * Math.PI * radius / radius_SubNode );

        // for minNodes
        angleInc = 2*Math.PI / minNodes; 
        radiusInc = (radius_SubNode + safety_gap) / minNodes; 


        var x = radius*Math.cos( angle ) + centerX;
        var y = radius*Math.sin( angle ) + centerY;

        angle += angleInc + Math.PI/30;
        radius += radiusInc;

        node.position = { x: x, y: y};

      }

      if(nodes.length == 0)
        return radius_SubNode;

      return radius;
  }


  nextNode(0);

}

// -------------- Helper Functions
Array.prototype.hash = function(){
  
  var hash = [];

  this.map(function(a){
    hash[a.id] = a;
  })
  
  return hash;

}