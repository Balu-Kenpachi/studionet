angular.module('studionet')

.controller('NodeController', [ '$scope', '$http',  
                                'profile', 'users', 'attachments', 'GraphService', 'tags', '$rootScope',
                                function($scope, $http, profile, users, attachments, GraphService, tags, $rootScope){

        
        //////// --------------  general declarations
        $scope.user = profile.user;
        $scope.tags = tags.tags;
        $scope.random = Math.random();   // to prevent caching of profile images

        $scope.contribution = undefined, $scope.author = undefined, $scope.rate = undefined;
        $scope.usersHash = users.usersHash;

        /////// --------------- communication with parent container
        var target = document.getElementById('cy');
        var sendMessage = function(message){
          $scope.$emit(BROADCAST_MESSAGE, message );
        }

        var getReplies = function(){
          $scope.replies = [];
          GraphService.comments.nodes("[ref=" + $scope.contribution.id + "]").map(function(commentNode){
              GraphService.getNode(commentNode.id());
              $scope.replies.push(commentNode.data());
          })
        }


        $scope.$on( 'VIEWMODE_ACTIVE', function(event, args) {
            $scope.setData(args.data);
        });
        
        ////// ---- Modal related functions
        $scope.setData = function(node){
            
            // will be used internally by the reply feature
            if( !(node instanceof Object )){
              node = GraphService.comments.getElementById(node).length ? GraphService.comments.getElementById(node) : GraphService.graph.getElementById(node);
            }

            $scope.showComments = true;
            
            GraphService.getNode( node );

            $scope.contribution = node.data();

            $scope.parents = node.outgoers().nodes();
            $scope.children = node.incomers().nodes();


            getReplies();

            $scope.bookmarked = false;
            $scope.rate = getRating( $scope.contribution.id );   // check if the user has already rated this contribution
            $scope.author = users.getUser( $scope.contribution.createdBy, false );  // get the author details

            GraphService.updateViewCount($scope.contribution.id);    // update the viewcount of the contribution
            
            node.addClass('read');

        }


        $scope.cancel = function(){
            $scope.contributionData = { attachments: [], tags: []}; //store the data of replying information
            $scope.replyMode = false;
            $scope.updateMode = false;
            $scope.commentMode = false;
        }


        //  This close function doesn't need to use jQuery or bootstrap, because
        //  the button has the 'data-dismiss' attribute.
        $scope.close = function() {

            $scope.cancel();

            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();

            $('#contributionViewModal').modal('hide');

            $scope.$emit(BROADCAST_VIEWMODE_OFF, {} );

        };



        //////------------------ Dealing with Ratings
        $scope.rate = 0;
        $scope.max = 5;
        $scope.overStar = null; 
        $scope.percent = 0;

        // gets rating if the user has previously rated the contribution
        var previouslyRated = 0;
        var getRating = function(contribution_id){
          var rating = 0;
          for(var i=0; i < profile.activity.length; i++){

            var user_contribution = profile.activity[i];
            if( user_contribution.type == "RATED" && user_contribution.end == contribution_id ){
              rating = user_contribution.properties.rating;
            }

            // check for bookmark
            if( user_contribution.type == "BOOKMARKED" && user_contribution.end == contribution_id ){
              $scope.bookmarked = true;
            }          

          }
          previouslyRated = rating;
          return rating;
        }

        $scope.hoveringOver = function(value) {
          $scope.overStar = value;
          $scope.percent = 100 * (value / $scope.max);
        };
        
        $scope.rateContribution = function(rating, id){

          track("rate-node");

          GraphService.rateNode(id, rating).success(function(data){

              // check if user had already rated this contribution
              if(previouslyRated==0){
                $scope.contribution.rateCount++;
                $scope.contribution.ratingArray[rating-5]++; console.log("here2")
              }
              else{

                $scope.contribution.ratingArray[5 - rating] = $scope.contribution.ratingArray[5 - rating] + 1; 
                $scope.contribution.ratingArray[5 - previouslyRated] = $scope.contribution.ratingArray[5 - previouslyRated] - 1; 
                previouslyRated = rating;

              }

          })
        }

        $scope.toggleBookmark = function(contribution_id){

            track("bookmark-node");
            
            if($scope.bookmarked){
              GraphService.removeBookmark(contribution_id).success(function(data){
                $scope.bookmarked = false;
                alert("Bookmark was removed");
              })        
            }
            else{
              GraphService.bookmarkNode(contribution_id).success(function(data){
                $scope.bookmarked = true;
                alert("Node added to bookmarks");
              })                  
            }

        }

        ////////-------------- Dealing with attachments
        $scope.getThumb = function(contributionId, attachment){
            if(attachment.thumb)
              return "/api/contributions/" + contributionId + /attachments/+ attachment.id + "/thumbnail";
            else{

              if(attachment.name.indexOf(".pdf") > -1)
                return "./img/file_pdf.jpeg"
              else if(attachment.name.indexOf(".doc") > -1)
                return "./img/file_doc.png"
              else
                return "./img/file_default.png"; // replace with image for particular extension
            }
        }

        //Uploaded files
        $scope.uplodateFiles = function (files, contributionData){
            console.log(files.length + " file(s) have been choosen.");
            if(files){
                files.forEach(function(file){
                      contributionData.attachments.push(file);
                });
            }   
        }

        //remove files
        $scope.removeFiles = function (attachment, contributionData) {
              var index = contributionData.attachments.indexOf(attachment);
              if(index > -1){
                    contributionData.attachments.splice(index, 1);
              }
        }

        $scope.removeFilesAndfromDB = function (attachment, contributionData){

            // if attachment is an inline image, delete the corresponding img src in the contribution body
            var result = null;
            if(attachment.attachment.name.startsWith("studionet-inline-img-")){
              result = contributionData.body.match('<img(.*)' + attachment.attachment.name + '(.*)\/>')
            }

            if(result == null){
              attachments.deleteAttachmentbyId(attachment.id, $scope.contribution.id)
                .then(function(res){
                  var index = contributionData._attachments.indexOf(attachment);
                  if(index > -1){
                        contributionData._attachments.splice(index, 1);
                        $scope.contribution.body = contributionData.body;
                        alert("Attachment was successfully deleted");
                  }
                }, function(error){
                  alert('[WARNING]: Deleting attachment is unsuccessful');
                })
            }
            else{
              alert("Cannot delete inline attachment. Please remove the image in the content first.")
            }
        
        }




        /////// ------------------------ Dealing with tags

        // Tags
        $scope.loadTags =  function($query){
                return tags.tags.filter(function(tag){
                  return tag.name.toLowerCase().search($query.toLowerCase()) != -1;
                });
        }


        ////// -------- Additional components (Read, Update, Delete)

        $scope.contributionData = { attachments: [], tags: []}; //store the data of replying information
        $scope.comment = "";
      
        //--------------- Function: - Comment
        $scope.commentMode = false;
        $scope.showCommentModal = function(){
          $scope.commentMode = true;
          track("comment-node");
        }

        $scope.postComment = function(comment){
            if(!comment) return;

            var commentData = { attachments: [], tags: [] }

            commentData.title = "Re: " + $scope.contribution.title;
            commentData.body = comment;


            commentData.ref = $scope.contribution.id;

            commentData.contentType = 'comment'; /// default
            commentData.tags = [];

            // default relationship type for everything
            commentData.refType = 'COMMENT_FOR';

            $scope.commentMode = false;
            GraphService.createNode( commentData ).then(function(res){
                  
                  sendMessage( {status: 200, message: "Successfully commented on node" } );
                  getReplies();
                  $scope.showComments = true;

            }, function(error){

                  sendMessage( {status: 200, message: "Error commenting on node. Please try again." } );
                  $scope.close();
            }); 
        }


        //----------------- Function: - Reply 
        $scope.replyMode = false;
        $scope.showReplyModal = function(id, type){
          track("reply-node");
          $scope.replyMode = true;
          $scope.contributionData = { attachments: [], tags: []}; //store the data of replying information
        }

        $scope.replyToContribution = function(contributionData, parentId){


              if(!contributionData) return;

              if(contributionData.title == undefined || contributionData.title.length == 0 || contributionData.body == undefined || contributionData.body.length == 0){
                alert("Node must have a title and body!");
                return;
              }

              contributionData.ref = parentId;

              contributionData.contentType = 'text'; /// default
              contributionData.tags = [];

              // default relationship type for everything
              contributionData.refType = 'RELATED_TO';


              if(contributionData.attachments == undefined)
                contributionData.attachments = [];

              // if _tags is defined
              if(contributionData._tags)
                  contributionData._tags.map(function(t){
                      contributionData.tags.push(t.name.toLowerCase().trim());
                  });

              GraphService.createNode( contributionData ).then(function(res){
                    
                    sendMessage( {status: 200, message: "Successfully replied to node" } );
                    $scope.replyMode = false;

              }, function(error){

                    sendMessage( {status: 200, message: "Error replying to node. Please try again." } );
                    $scope.close();
              }); 
        };


        //----------------- Function: - Update
        $scope.updateMode = false;
        $scope.showUpdateModal = function(id){

              track("update-node");
              $scope.updateMode = true;
              $scope.contributionData = jQuery.extend({}, $scope.contribution);
              $scope.contributionData.contentType = $scope.contribution.type; 

              if($scope.contributionData.attachments[0].id == null){
                $scope.contributionData.attachments = [];
              }

              $scope.contributionData._tags = $scope.contribution.tags.map(function(t){
                  return t;
              });
              
              $scope.contributionData._attachments = $scope.contributionData.attachments;
              $scope.contributionData.attachments = [];
        }

        $scope.updateContribution = function(updateContribution){

          if(!updateContribution.title || !updateContribution.body){
            alert("Please input the title or content of the node!");
            return;
          }

          updateContribution.tags = [];
          if(updateContribution._tags.length > 0)
            updateContribution._tags.map(function(t){
              updateContribution.tags.push(t.name.toLowerCase().trim());
            });
          //delete updateContribution._tags;

          //Remove the attachments that have already existed in the database
          //Newly chosen attachment should not have the 'attachment' property
          for(var i = 0; i < updateContribution.attachments; i++){
            if(updateContribution.attachments[i].attachment){
              updateContribution.attachments.splice(i--, 1);
            }
          }

          $scope.updateMode = false;
          GraphService.updateNode(updateContribution).then(function(res){

                sendMessage( {status: 200, message: "Successfully updated node." } );

          }, function(error){
                sendMessage( {status: 500, message: "Error updating node" } );
                $scope.close();
          });
        };


        // ------------------Function: - Delete
        $scope.deleteContribution = function(contributionId){
            track("delete-node");
            GraphService.deleteNode(contributionId).then(function(){
                sendMessage({status: 200, message: "Successfully deleted node." });
                $scope.close();
            }, function(error){
                sendMessage({status: 500, message: "Error deleting node" });
                $scope.close();
            });

            $scope.close();
       
        };


        // -----------------Function - Author Profile
        $scope.showAuthorModal = function(){
          track("view-author");
          //$scope.authorMode = true;
          $rootScope.$broadcast( "PROFILE_MODE",  {id: $scope.contribution.createdBy, standalone: false});
          $('#profileModal').modal({backdrop: 'static', keyboard: false});
        }


        $scope.track = function(activity){
          if(window["ga"] == undefined){
            console.log("ga is not defined");
          }
          else{
            ga("send", "event", "action", activity, "/node");
          }
        }

        var track = $scope.track;



}]);